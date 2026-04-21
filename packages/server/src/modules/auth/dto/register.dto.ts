import { IsString, IsOptional, IsBoolean, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsString()
  @MinLength(6)
  @MaxLength(32)
  password: string;

  @IsString()
  @IsOptional()
  realName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  agreedToAgreement?: boolean;
}
