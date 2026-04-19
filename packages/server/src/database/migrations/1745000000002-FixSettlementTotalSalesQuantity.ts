import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 修复 settlements 表缺少 totalSalesQuantity 字段
 * 修复 subscription_orders 表缺少 unsettledAmount 字段
 */
export class FixSettlementTotalSalesQuantity1745000000002 implements MigrationInterface {
  name = 'FixSettlementTotalSalesQuantity1745000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 添加 settlements.totalSalesQuantity 字段
    await queryRunner.query(`
      ALTER TABLE "settlements" 
      ADD COLUMN IF NOT EXISTS "totalSalesQuantity" INTEGER NOT NULL DEFAULT 0
    `);

    // 2. 添加 subscription_orders.unsettledAmount 字段
    await queryRunner.query(`
      ALTER TABLE "subscription_orders" 
      ADD COLUMN IF NOT EXISTS "unsettledAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0
    `);

    // 3. 为已有数据填充 unsettledAmount（使用 amount 字段的值）
    await queryRunner.query(`
      UPDATE "subscription_orders" 
      SET "unsettledAmount" = "amount" 
      WHERE "unsettledAmount" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 删除 subscription_orders.unsettledAmount 字段
    await queryRunner.query(`
      ALTER TABLE "subscription_orders" 
      DROP COLUMN IF EXISTS "unsettledAmount"
    `);

    // 2. 删除 settlements.totalSalesQuantity 字段
    await queryRunner.query(`
      ALTER TABLE "settlements" 
      DROP COLUMN IF EXISTS "totalSalesQuantity"
    `);
  }
}
