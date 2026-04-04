import {
  IsInt,
  Min,
  IsOptional,
  IsNumber,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDailySalesDto {
  @IsOptional()
  @IsInt({ message: '销量必须是整数' })
  @Min(1, { message: '最少销售1盒' })
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsNumber({}, { message: '实际售价必须是数字' })
  @Min(0, { message: '售价不能为负数' })
  @Type(() => Number)
  actualSellingPrice?: number;

  @IsOptional()
  @IsString({ message: '终端名称必须是字符串' })
  terminal?: string;
}
