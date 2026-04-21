import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class AdjustBalanceDto {
  @IsNumber()
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
