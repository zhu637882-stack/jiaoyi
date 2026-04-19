import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateSystemMessageDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  @IsIn(['announcement', 'notification', 'maintenance'])
  type?: string; // announcement | notification | maintenance
}
