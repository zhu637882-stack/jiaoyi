import { IsOptional, IsUUID, IsEnum, IsInt, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { SubscriptionOrderStatus } from '../../../database/entities/subscription-order.entity';

// 过滤非法枚举值：空字符串、逗号分隔值、非枚举成员一律转为 undefined
const transformStatus = ({ value }: { value: string }) => {
  if (!value || value === '' || value.includes(',')) return undefined;
  const validValues = Object.values(SubscriptionOrderStatus);
  return validValues.includes(value as SubscriptionOrderStatus) ? value : undefined;
};

/**
 * 用户查询认购订单 DTO
 */
export class QuerySubscriptionDto {
  @IsOptional()
  @Transform(transformStatus)
  @IsEnum(SubscriptionOrderStatus)
  status?: SubscriptionOrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}

/**
 * 管理员查询认购订单 DTO
 */
export class AdminQuerySubscriptionDto {
  @IsOptional()
  @Transform(transformStatus)
  @IsEnum(SubscriptionOrderStatus)
  status?: SubscriptionOrderStatus;

  @IsOptional()
  @IsUUID()
  drugId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
