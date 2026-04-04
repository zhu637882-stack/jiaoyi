import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  realName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;
}
