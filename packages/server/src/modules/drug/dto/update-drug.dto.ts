import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateDrugDto {
  @IsOptional()
  @IsString({ message: '药品名称必须是字符串' })
  @Length(1, 100, { message: '药品名称长度必须在1-100之间' })
  name?: string;

  @IsOptional()
  @IsString({ message: '药品编码必须是字符串' })
  @Length(1, 50, { message: '药品编码长度必须在1-50之间' })
  code?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '采购价必须是数字，最多2位小数' })
  @Min(0, { message: '采购价不能为负数' })
  @Type(() => Number)
  purchasePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '售价必须是数字，最多2位小数' })
  @Min(0, { message: '售价不能为负数' })
  @Type(() => Number)
  sellingPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 }, { message: '总数量必须是整数' })
  @Min(1, { message: '总数量必须大于0' })
  @Type(() => Number)
  totalQuantity?: number;

  @IsOptional()
  @IsString({ message: '批次号必须是字符串' })
  @Length(1, 50, { message: '批次号长度必须在1-50之间' })
  batchNo?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '年化利率必须是数字，最多2位小数' })
  @Min(0, { message: '年化利率不能为负数' })
  @Max(100, { message: '年化利率不能超过100%' })
  @Type(() => Number)
  annualRate?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: '单位费用必须是数字，最多2位小数' })
  @Min(0, { message: '单位费用不能为负数' })
  @Type(() => Number)
  unitFee?: number;
}
