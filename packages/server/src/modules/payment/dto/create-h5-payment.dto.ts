import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

/**
 * H5 支付 DTO
 */
export class CreateH5PaymentDto {
  @IsNumber()
  @Min(0.01, { message: '充值金额必须大于0' })
  amount: number;
}
