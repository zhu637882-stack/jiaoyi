import { IsUUID, IsInt, Min, IsIn } from 'class-validator';

/**
 * 认购直付 DTO
 */
export class CreateSubscriptionPaymentDto {
  @IsUUID()
  drugId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsIn(['alipay', 'wechat'])
  channel: 'alipay' | 'wechat';
}
