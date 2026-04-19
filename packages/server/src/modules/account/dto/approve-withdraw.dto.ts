import { IsString, IsOptional } from 'class-validator';

export class ApproveWithdrawDto {
  @IsString()
  @IsOptional()
  bankTransactionNo?: string;

  @IsString()
  @IsOptional()
  rejectReason?: string;
}
