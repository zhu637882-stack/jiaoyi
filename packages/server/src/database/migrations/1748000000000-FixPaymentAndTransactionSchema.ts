import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 修复支付和交易表结构
 * 1. payment_orders 添加 subscriptionInfo 列（认购直付信息）
 * 2. account_transactions.type 从 VARCHAR 改为 ENUM（保证类型安全）
 * 3. 添加 SETTLEMENT 交易类型
 */
export class FixPaymentAndTransactionSchema1748000000000 implements MigrationInterface {
  name = 'FixPaymentAndTransactionSchema1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== 1. payment_orders 添加 subscriptionInfo 列 ==========
    // TypeORM simple-json 类型在 PostgreSQL 中实际存储为 text
    await queryRunner.query(`
      ALTER TABLE "payment_orders"
      ADD COLUMN IF NOT EXISTS "subscriptionInfo" text
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "payment_orders"."subscriptionInfo" IS '认购直付信息'
    `);

    // ========== 2. account_transactions.type 处理 ==========
    // 先将旧的 'funding' 类型映射为 'subscription'（历史遗留数据）
    await queryRunner.query(`
      UPDATE "account_transactions" SET "type" = 'subscription' WHERE "type" = 'funding'
    `);

    // 创建交易类型枚举（包含所有历史和新增类型）
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "account_transaction_type_enum" AS ENUM (
          'recharge', 'withdraw', 'subscription', 'settlement',
          'principal_return', 'profit_share', 'loss_share',
          'slow_sell_refund', 'return_profit', 'yield', 'admin_adjust'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // 将现有 VARCHAR 数据转换为 ENUM
    await queryRunner.query(`
      ALTER TABLE "account_transactions"
      ALTER COLUMN "type" TYPE "account_transaction_type_enum"
      USING "type"::"account_transaction_type_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 还原 account_transactions.type 为 VARCHAR
    await queryRunner.query(`
      ALTER TABLE "account_transactions"
      ALTER COLUMN "type" TYPE VARCHAR
      USING "type"::VARCHAR
    `);

    // 删除枚举类型
    await queryRunner.query(`DROP TYPE IF EXISTS "account_transaction_type_enum"`);

    // 还原 funding 类型
    await queryRunner.query(`
      UPDATE "account_transactions" SET "type" = 'funding' WHERE "type" = 'subscription' AND "description" LIKE '%funding%'
    `);

    // 删除 subscriptionInfo 列
    await queryRunner.query(`
      ALTER TABLE "payment_orders"
      DROP COLUMN IF EXISTS "subscriptionInfo"
    `);
  }
}
