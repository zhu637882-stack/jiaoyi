import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../database/entities/user.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
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
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        realName: user.realName,
        phone: user.phone,
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

  async register(username: string, password: string, realName?: string, phone?: string) {
    // 检查用户名是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { username },
    });

    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      role: UserRole.INVESTOR,
      realName,
      phone,
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
}
