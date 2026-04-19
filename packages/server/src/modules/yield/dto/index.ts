import { IsString, IsNumber, IsDateString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 财务填写补贴金 DTO
 */
export class FillSubsidyDto {
  @IsDateString()
  yieldDate: string; // 收益日期（通常填昨天的）

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubsidyItemDto)
  items: SubsidyItemDto[];
}

export class SubsidyItemDto {
  @IsString()
  orderId: string;

  @IsNumber()
  @Type(() => Number)
  subsidy: number;
}

/**
 * 批量生成日收益记录 DTO（管理员手动触发）
 */
export class GenerateDailyYieldDto {
  @IsOptional()
  @IsDateString()
  yieldDate?: string; // 不填则默认昨天
}

/**
 * 查询收益曲线 DTO
 */
export class QueryYieldCurveDto {
  @IsOptional()
  @IsString()
  drugId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 管理员查询待填写补贴金列表 DTO
 */
export class QueryPendingSubsidyDto {
  @IsOptional()
  @IsDateString()
  yieldDate?: string;

  @IsOptional()
  @IsString()
  drugId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number;

  @IsOptional()
  @IsString()
  includeFilled?: string; // 'true' 则包含已填写的记录
}
