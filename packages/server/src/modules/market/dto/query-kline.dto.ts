import { IsString, IsOptional, IsEnum } from 'class-validator';

export enum KLinePeriod {
  // 新的专业K线周期
  FIFTEEN_MIN = '15m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d',
  ONE_WEEK = '1w',
  ONE_MONTH = '1mo',
  // 保留旧值用于兼容
  SEVEN_DAYS = '7d',
  THIRTY_DAYS = '30d',
  NINETY_DAYS = '90d',
  ALL = 'all',
}

export class QueryKLineDto {
  @IsEnum(KLinePeriod)
  @IsOptional()
  period?: KLinePeriod = KLinePeriod.ONE_DAY;
}
