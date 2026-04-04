import {
  IsUUID,
  IsInt,
  Min,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDailySalesDto {
  @IsUUID('4', { message: '药品ID格式不正确' })
  @IsNotEmpty({ message: '药品ID不能为空' })
  drugId: string;

  @IsDateString({}, { message: '销售日期格式不正确' })
  @IsNotEmpty({ message: '销售日期不能为空' })
  saleDate: string;

  @IsInt({ message: '销量必须是整数' })
  @Min(1, { message: '最少销售1盒' })
  @Type(() => Number)
  quantity: number;

  @IsNumber({}, { message: '实际售价必须是数字' })
  @Min(0, { message: '售价不能为负数' })
  @Type(() => Number)
  actualSellingPrice: number;

  @IsString({ message: '终端名称必须是字符串' })
  @IsNotEmpty({ message: '终端名称不能为空' })
  terminal: string;
}
