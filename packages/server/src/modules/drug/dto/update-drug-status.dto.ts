import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { DrugStatus } from '../../../database/entities/drug.entity';

export class UpdateDrugStatusDto {
  @IsEnum(DrugStatus, { message: '状态值无效' })
  status: DrugStatus;

  @IsOptional()
  @IsString({ message: '原因必须是字符串' })
  @Length(0, 200, { message: '原因长度不能超过200' })
  reason?: string;
}
