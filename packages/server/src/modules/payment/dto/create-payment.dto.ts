import { IsNumber, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01, { message: '充值金额必须大于0' })
  amount: number;
}
