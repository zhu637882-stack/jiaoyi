import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDrugDto {
  @IsString({ message: '药品名称必须是字符串' })
  @Length(1, 100, { message: '药品名称长度必须在1-100之间' })
  name: string;

  @IsString({ message: '药品编码必须是字符串' })
  @Length(1, 50, { message: '药品编码长度必须在1-50之间' })
  code: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: '采购价必须是数字，最多2位小数' })
  @Min(0, { message: '采购价不能为负数' })
  @Type(() => Number)
  purchasePrice: number;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: '售价必须是数字，最多2位小数' })
  @Min(0, { message: '售价不能为负数' })
  @Type(() => Number)
  sellingPrice: number;

  @IsNumber({ maxDecimalPlaces: 0 }, { message: '总数量必须是整数' })
  @Min(1, { message: '总数量必须大于0' })
  @Type(() => Number)
  totalQuantity: number;

  @IsString({ message: '批次号必须是字符串' })
  @Length(1, 50, { message: '批次号长度必须在1-50之间' })
  batchNo: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 }, { message: '运营费用比例必须是数字，最多4位小数' })
  @Min(0, { message: '运营费用比例不能为负数' })
  @Type(() => Number)
  operationFeeRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 }, { message: '滞销天数必须是整数' })
  @Min(1, { message: '滞销天数必须大于0' })
  @Type(() => Number)
  slowSellingDays?: number;
}
