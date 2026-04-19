import { IsUUID, IsInt, Min } from 'class-validator';

/**
 * 创建认购订单 DTO
 */
export class CreateSubscriptionDto {
  @IsUUID()
  drugId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
