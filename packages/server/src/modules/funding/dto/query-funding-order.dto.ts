import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FundingOrderStatus } from '../../../database/entities/funding-order.entity';

export class QueryFundingOrderDto {
  @IsOptional()
  @IsEnum(FundingOrderStatus, { message: '状态值无效' })
  status?: FundingOrderStatus;

  @IsOptional()
  @IsUUID('4', { message: '药品ID格式不正确' })
  drugId?: string;

  @IsOptional()
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为1' })
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量最小为1' })
  @Type(() => Number)
  pageSize?: number = 10;
}

export class FundingOrderStatusQueryDto {
  @IsOptional()
  @IsEnum(FundingOrderStatus, { message: '状态值无效' })
  status?: FundingOrderStatus;
}
