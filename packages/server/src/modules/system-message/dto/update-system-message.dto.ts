import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateSystemMessageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @IsIn(['announcement', 'notification', 'maintenance'])
  type?: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;
}
