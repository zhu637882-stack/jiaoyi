import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus, UserRole } from '../../database/entities/user.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ReviewUserDto } from './dto/review-user.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';

@Injectable()
export class UserService {
  private logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AccountBalance)
    private accountBalanceRepository: Repository<AccountBalance>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findAll(): Promise<Omit<User, 'password'>[]> {
    const users = await this.userRepository.find({
      where: { role: UserRole.USER },  // 只返回普通客户
      order: { createdAt: 'DESC' },
    });
    return users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  async getUserWithBalance(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const balance = await this.accountBalanceRepository.findOne({
      where: { userId },
    });

    const { password, ...userWithoutPassword } = user;

    return {
      ...userWithoutPassword,
      balance: balance || {
        availableBalance: 0,
        frozenBalance: 0,
        totalProfit: 0,
        totalInvested: 0,
      },
    };
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    await this.userRepository.update(userId, updateUserDto);

    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    const { password, ...result } = updatedUser!;
    return result;
  }

  async reviewUser(userId: string, reviewUserDto: ReviewUserDto, reviewerId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException('该用户已审核，无法重复审核');
    }

    if (reviewUserDto.status === UserStatus.REJECTED && !reviewUserDto.remark) {
      throw new BadRequestException('拒绝审核时必须填写备注');
    }

    await this.userRepository.update(userId, {
      status: reviewUserDto.status,
      reviewRemark: reviewUserDto.remark,
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    });

    const updatedUser = await this.userRepository.findOne({
      where: { id: userId },
    });

    const { password, ...result } = updatedUser!;
    return {
      message: reviewUserDto.status === UserStatus.APPROVED ? '审核通过' : '审核拒绝',
      user: result,
    };
  }

  async deleteUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('不能删除超级管理员账户');
    }

    await this.userRepository.remove(user);
    return {
      success: true,
      message: '用户删除成功',
    };
  }

  // ============ 管理员管理方法 ============

  /**
   * 获取所有管理员列表（role != 'user'）
   */
  async findAdmins(): Promise<Omit<User, 'password'>[]> {
    const admins = await this.userRepository.find({
      where: [
        { role: UserRole.VIEWER },
        { role: UserRole.MANAGER },
        { role: UserRole.ADMIN },
      ],
      order: { createdAt: 'DESC' },
    });
    return admins.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  /**
   * 创建管理员账户
   */
  async createAdmin(createAdminDto: CreateAdminDto, operatorId: string): Promise<Omit<User, 'password'>> {
    // 检查用户名是否已存在
    const existingUser = await this.userRepository.findOne({
      where: { username: createAdminDto.username },
    });
    if (existingUser) {
      throw new BadRequestException('用户名已存在');
    }

    // 哈希密码
    const hashedPassword = await bcrypt.hash(createAdminDto.password, 10);

    // 创建管理员用户
    const admin = this.userRepository.create({
      username: createAdminDto.username,
      password: hashedPassword,
      role: createAdminDto.role,
      status: UserStatus.APPROVED, // 管理员直接通过
      realName: createAdminDto.realName,
      phone: createAdminDto.phone,
      agreedToAgreement: true,
      agreedAt: new Date(),
    });

    const savedAdmin = await this.userRepository.save(admin);

    // 创建账户余额记录
    const accountBalance = this.accountBalanceRepository.create({
      userId: savedAdmin.id,
      availableBalance: 0,
      frozenBalance: 0,
      totalProfit: 0,
      totalInvested: 0,
    });
    await this.accountBalanceRepository.save(accountBalance);

    this.logger.log(`管理员 ${createAdminDto.username} (角色: ${createAdminDto.role}) 由 ${operatorId} 创建`);

    const { password, ...result } = savedAdmin;
    return result;
  }

  /**
   * 更新管理员信息（角色/状态）
   */
  async updateAdmin(adminId: string, updateDto: AdminUpdateUserDto, operatorId: string): Promise<Omit<User, 'password'>> {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('用户不存在');
    }

    // 检查是否为管理员
    if (admin.role === UserRole.USER) {
      throw new BadRequestException('该用户不是管理员，请使用普通用户编辑功能');
    }

    // 不能降级超级管理员（username=admin的账户）
    if (admin.username === 'admin' && updateDto.role && updateDto.role !== UserRole.ADMIN) {
      throw new ForbiddenException('不能降级超级管理员');
    }

    // 更新字段
    const updateData: Partial<User> = {};
    if (updateDto.role) updateData.role = updateDto.role;
    if (updateDto.realName !== undefined) updateData.realName = updateDto.realName;
    if (updateDto.phone !== undefined) updateData.phone = updateDto.phone;

    // adminStatus 用于禁用/启用管理员
    if (updateDto.adminStatus === 'disabled') {
      updateData.status = UserStatus.REJECTED;
    } else if (updateDto.adminStatus === 'active') {
      updateData.status = UserStatus.APPROVED;
    }

    await this.userRepository.update(adminId, updateData);

    this.logger.log(`管理员 ${admin.username} 由 ${operatorId} 更新: ${JSON.stringify(updateDto)}`);

    const updatedAdmin = await this.userRepository.findOne({
      where: { id: adminId },
    });
    const { password, ...result } = updatedAdmin!;
    return result;
  }

  /**
   * 删除（禁用）管理员
   */
  async deleteAdmin(adminId: string, operatorId: string) {
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException('用户不存在');
    }

    // 不能删除超级管理员
    if (admin.username === 'admin') {
      throw new ForbiddenException('不能删除超级管理员账户');
    }

    // 不能删除自己（已在controller层检查，双重保险）
    if (adminId === operatorId) {
      throw new ForbiddenException('不能删除自己');
    }

    // 将管理员降级为普通用户而不是真正删除
    await this.userRepository.update(adminId, {
      role: UserRole.USER,
      status: UserStatus.PENDING,
    });

    this.logger.log(`管理员 ${admin.username} 由 ${operatorId} 移除管理员权限`);

    return {
      success: true,
      message: '管理员已移除权限，已降级为普通用户',
    };
  }
}
