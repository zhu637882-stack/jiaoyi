import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 新增 originalAmount 字段到 subscription_orders 表
 * 用于记录订单原始投入金额，确保清算时本金退回金额准确
 */
export class AddOriginalAmount1745000000001 implements MigrationInterface {
  name = 'AddOriginalAmount1745000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 新增 originalAmount 字段
    await queryRunner.query(`
      ALTER TABLE "subscription_orders" 
      ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0
    `);

    // 为已有数据填充 originalAmount（使用 amount 字段的值）
    await queryRunner.query(`
      UPDATE "subscription_orders" 
      SET "originalAmount" = "amount" 
      WHERE "originalAmount" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除 originalAmount 字段
    await queryRunner.query(`
      ALTER TABLE "subscription_orders" 
      DROP COLUMN IF EXISTS "originalAmount"
    `);
  }
}
