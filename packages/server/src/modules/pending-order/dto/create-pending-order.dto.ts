import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';
import { PendingOrderType } from '../../../database/entities/pending-order.entity';

export class CreatePendingOrderDto {
  @IsUUID()
  drugId: string;

  @IsEnum(PendingOrderType)
  type: PendingOrderType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  targetPrice: number;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsDateString()
  expireAt?: string;
}
