import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

/**
 * JSAPI 支付 DTO
 */
export class CreateJsapiPaymentDto {
  @IsNumber()
  @Min(0.01, { message: '充值金额必须大于0' })
  amount: number;

  @IsOptional()
  @IsString()
  openId?: string;
}
