import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
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

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
