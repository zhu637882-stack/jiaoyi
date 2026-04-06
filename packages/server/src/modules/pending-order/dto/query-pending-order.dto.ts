import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PendingOrderStatus } from '../../../database/entities/pending-order.entity';

export class QueryPendingOrderDto {
  @IsOptional()
  @IsEnum(PendingOrderStatus)
  status?: PendingOrderStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 10;
}
