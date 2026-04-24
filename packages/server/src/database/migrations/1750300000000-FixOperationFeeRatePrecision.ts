import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixOperationFeeRatePrecision1750300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "drugs" ALTER COLUMN "operationFeeRate" TYPE DECIMAL(10, 2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "drugs" ALTER COLUMN "operationFeeRate" TYPE DECIMAL(5, 4)`);
  }
}
