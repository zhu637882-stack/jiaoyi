import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../../database/entities/user.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { AuditService } from '../../common/services/audit.service';
import { InvitationService } from '../invitation/invitation.service';
import { TrialBonusService } from '../trial-bonus/trial-bonus.service';

@Injectable()
export class AuthService {
  private logger = new Logger(AuthService.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
    private auditService: AuditService,
    private invitationService: InvitationService,
    private trialBonusService: TrialBonusService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({
      where: { username },
    });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    // 递增登录次数
    const userEntity = await this.userRepository.findOne({ where: { id: user.id } });
    if (userEntity) {
      userEntity.loginCount = (userEntity.loginCount || 0) + 1;
      await this.userRepository.save(userEntity);
    }

    const payload = { 
      userId: user.id, 
      username: user.username, 
      role: user.role 
    };
    
    // 生成 access_token (短有效期)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '7d'),
    });
    
    // 生成 refresh_token (长有效期: 30天)
    const refreshToken = this.jwtService.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '30d' },
    );

    // 记录审计日志 - 登录
    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      targetType: 'user',
      targetId: user.id,
      detail: {
        username: user.username,
        role: user.role,
      },
    });
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        realName: user.realName,
        phone: user.phone,
        loginCount: userEntity?.loginCount || 1,
      },
    };
  }

  /**
   * 刷新 Token
   * @param refreshToken 刷新令牌
   */
  async refreshToken(refreshToken: string) {
    try {
      // 验证 refresh_token
      const payload = this.jwtService.verify(refreshToken);
      
      // 检查是否为 refresh 类型的 token
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('无效的刷新令牌');
      }

      // 查询用户确保仍然存在
      const user = await this.userRepository.findOne({
        where: { id: payload.userId },
      });

      if (!user) {
        throw new UnauthorizedException('用户不存在');
      }

      // 生成新的 access_token
      const newPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };
      
      const accessToken = this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '7d'),
      });
      
      // 生成新的 refresh_token
      const newRefreshToken = this.jwtService.sign(
        { userId: user.id, type: 'refresh' },
        { expiresIn: '30d' },
      );

      return {
        access_token: accessToken,
        refresh_token: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('刷新令牌已过期或无效');
    }
  }

  async register(username: string, password: string, realName?: string, phone?: string, agreedToAgreement?: boolean, invitationCode?: string) {
    // 检查用户名是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户（状态为待审核）
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      role: UserRole.USER,
      status: UserStatus.PENDING,  // 新注册用户默认为待审核
      realName,
      phone,
      agreedToAgreement: agreedToAgreement ?? false,
      agreedAt: agreedToAgreement ? new Date() : undefined,
    });

    const savedUser = await this.userRepository.save(user);

    // 创建账户余额记录
    const accountBalance = this.accountBalanceRepository.create({
      userId: savedUser.id,
      availableBalance: 0,
      frozenBalance: 0,
      totalProfit: 0,
      totalInvested: 0,
    });
    await this.accountBalanceRepository.save(accountBalance);

    // 自动生成用户的邀请码（失败不影响注册）
    try {
      await this.invitationService.generateInvitationCode(savedUser.id);
    } catch (e: unknown) {
      const err = e as Error;
      this.logger.warn(`生成邀请码失败（不影响注册）: ${err.message}`);
    }

    // 如果传入了邀请码，绑定邀请关系（失败不影响注册）
    if (invitationCode) {
      try {
        await this.invitationService.applyInvitationCode(savedUser.id, invitationCode);
      } catch (e: unknown) {
        const err = e as Error;
        this.logger.warn(`绑定邀请码失败（不影响注册）: ${err.message}`);
      }
    }

    // 发放体验金（失败不影响注册）
    try {
      await this.trialBonusService.grantTrialBonus(savedUser.id);
    } catch (e: unknown) {
      const err = e as Error;
      this.logger.warn(`体验金发放失败（不影响注册）: ${err.message}`);
    }

    const { password: _, ...result } = savedUser;
    return result;
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const { password, ...result } = user;
    return result;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('旧密码不正确');
    }

    // 哈希新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // 记录审计日志
    await this.auditService.log({
      userId,
      action: 'CHANGE_PASSWORD',
      targetType: 'user',
      targetId: userId,
      detail: { message: '密码修改成功' },
    });

    return { success: true, message: '密码修改成功' };
  }
}
