import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuerySettlementDto {
  @IsOptional()
  @IsUUID('4', { message: '药品ID格式不正确' })
  drugId?: string;

  @IsOptional()
  @IsDateString({}, { message: '开始日期格式不正确' })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: '结束日期格式不正确' })
  endDate?: string;

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

export class SettlementPreviewQueryDto {
  @IsUUID('4', { message: '药品ID格式不正确' })
  drugId: string;

  @IsDateString({}, { message: '日期格式不正确' })
  date: string;
}
