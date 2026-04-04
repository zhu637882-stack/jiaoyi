import {
  IsUUID,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export class ExecuteSettlementDto {
  @IsUUID('4', { message: '药品ID格式不正确' })
  @IsNotEmpty({ message: '药品ID不能为空' })
  drugId: string;

  @IsDateString({}, { message: '清算日期格式不正确' })
  @IsNotEmpty({ message: '清算日期不能为空' })
  settlementDate: string;
}
