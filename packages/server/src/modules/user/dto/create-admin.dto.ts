import { IsString, MinLength, MaxLength, IsIn, IsOptional } from 'class-validator';
import { UserRole } from '../../../database/entities/user.entity';

export class CreateAdminDto {
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password: string;

  @IsString()
  @IsIn([UserRole.VIEWER, UserRole.MANAGER, UserRole.ADMIN])
  role: UserRole;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  realName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;
}
