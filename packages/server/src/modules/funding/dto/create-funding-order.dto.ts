import {
  IsUUID,
  IsInt,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFundingOrderDto {
  @IsUUID('4', { message: '药品ID格式不正确' })
  @IsNotEmpty({ message: '药品ID不能为空' })
  drugId: string;

  @IsInt({ message: '数量必须是整数' })
  @Min(1, { message: '最少垫资1盒' })
  @Type(() => Number)
  quantity: number;
}
