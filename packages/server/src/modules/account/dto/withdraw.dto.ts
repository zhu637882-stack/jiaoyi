import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class WithdrawDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  bankInfo?: string;
}
