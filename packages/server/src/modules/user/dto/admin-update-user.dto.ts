import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class AdminUpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  realName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsString()
  @IsOptional()
  @IsIn([UserRole.USER, UserRole.VIEWER, UserRole.MANAGER, UserRole.ADMIN])
  role?: UserRole;

  @IsString()
  @IsOptional()
  @IsIn(['active', 'disabled'])
  adminStatus?: string;
}
