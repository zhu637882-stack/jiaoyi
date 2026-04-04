import { IsString, IsDateString, IsOptional } from 'class-validator';

export class CreateSnapshotDto {
  @IsString()
  drugId: string;

  @IsDateString()
  @IsOptional()
  snapshotDate?: string;
}
