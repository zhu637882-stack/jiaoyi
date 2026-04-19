import { IsString, IsOptional, IsEnum } from 'class-validator';
import { UserStatus } from '../../../database/entities/user.entity';

export class ReviewUserDto {
  @IsEnum(UserStatus)
  status: UserStatus;  // approved 或 rejected

  @IsString()
  @IsOptional()
  remark?: string;  // 审核备注（拒绝时必填）
}
