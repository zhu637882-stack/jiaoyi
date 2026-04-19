import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../database/entities/user.entity';
import { AccountBalance } from '../../database/entities/account-balance.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ReviewUserDto } from './dto/review-user.dto';

@Injectable()
export class UserService {
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
}
