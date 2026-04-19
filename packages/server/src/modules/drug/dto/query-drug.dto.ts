import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { DrugStatus } from '../../../database/entities/drug.entity';

// 过滤非法枚举值：空字符串、逗号分隔值、非枚举成员一律转为 undefined
const transformDrugStatus = ({ value }: { value: string }) => {
  if (!value || value === '' || value.includes(',')) return undefined;
  const validValues = Object.values(DrugStatus);
  return validValues.includes(value as DrugStatus) ? value : undefined;
};

export class QueryDrugDto {
  @IsOptional()
  @Transform(transformDrugStatus)
  @IsEnum(DrugStatus, { message: '状态值无效' })
  status?: DrugStatus;

  @IsOptional()
  @IsString({ message: '搜索关键词必须是字符串' })
  keyword?: string;

  @IsOptional()
  @IsInt({ message: '页码必须是整数' })
  @Min(1, { message: '页码最小为1' })
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量最小为1' })
  @Max(100, { message: '每页数量最大为100' })
  @Type(() => Number)
  pageSize?: number = 10;

  @IsOptional()
  @IsString({ message: '排序字段必须是字符串' })
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString({ message: '排序方向必须是字符串' })
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
