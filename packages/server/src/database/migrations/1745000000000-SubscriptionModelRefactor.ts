import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 零钱保认购模式改造迁移
 * - 删除 pending_orders 表
 * - 重命名 funding_orders → subscription_orders 并修改字段
 * - 修改 drugs 表字段
 * - 修改 settlements 表字段
 */
export class SubscriptionModelRefactor1745000000000 implements MigrationInterface {
  name = 'SubscriptionModelRefactor1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== 1. 删除 pending_orders 表 ==========
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pending_orders_status_expireAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pending_orders_userId_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pending_orders_drugId_status_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pending_orders"`);

    // ========== 2. 重命名 funding_orders → subscription_orders ==========
    // 删除旧索引
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_funding_orders_drugId_status_fundedAt"`);

    // 重命名表
    await queryRunner.query(`ALTER TABLE "funding_orders" RENAME TO "subscription_orders"`);

    // 重命名约束
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "PK_funding_orders" TO "PK_subscription_orders"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "UQ_funding_orders_orderNo" TO "UQ_subscription_orders_orderNo"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "FK_funding_orders_userId" TO "FK_subscription_orders_userId"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "FK_funding_orders_drugId" TO "FK_subscription_orders_drugId"`);

    // 删除旧字段：fundedAt, settledAt, totalInterest
    await queryRunner.query(`ALTER TABLE "subscription_orders" DROP COLUMN IF EXISTS "fundedAt"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" DROP COLUMN IF EXISTS "settledAt"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" DROP COLUMN IF EXISTS "totalInterest"`);

    // 新增字段：confirmedAt, effectiveAt, slowSellingDeadline, returnedAt
    await queryRunner.query(`ALTER TABLE "subscription_orders" ADD COLUMN "confirmedAt" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" ADD COLUMN "effectiveAt" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" ADD COLUMN "slowSellingDeadline" TIMESTAMP NOT NULL DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" ADD COLUMN "returnedAt" TIMESTAMP`);

    // 创建新索引
    await queryRunner.query(`CREATE INDEX "IDX_subscription_orders_drugId_status_effectiveAt" ON "subscription_orders" ("drugId", "status", "effectiveAt")`);

    // ========== 3. 修改 drugs 表 ==========
    // 重命名 fundedQuantity → subscribedQuantity
    await queryRunner.query(`ALTER TABLE "drugs" RENAME COLUMN "fundedQuantity" TO "subscribedQuantity"`);

    // 删除 annualRate 字段
    await queryRunner.query(`ALTER TABLE "drugs" DROP COLUMN IF EXISTS "annualRate"`);

    // 重命名 unitFee → operationFeeRate，并修改精度
    await queryRunner.query(`ALTER TABLE "drugs" RENAME COLUMN "unitFee" TO "operationFeeRate"`);
    await queryRunner.query(`ALTER TABLE "drugs" ALTER COLUMN "operationFeeRate" TYPE DECIMAL(5, 4)`);
    await queryRunner.query(`ALTER TABLE "drugs" ALTER COLUMN "operationFeeRate" SET DEFAULT 0`);

    // 新增 slowSellingDays 字段
    await queryRunner.query(`ALTER TABLE "drugs" ADD COLUMN "slowSellingDays" INTEGER NOT NULL DEFAULT 90`);

    // ========== 4. 修改 settlements 表 ==========
    // 删除 totalInterest 字段
    await queryRunner.query(`ALTER TABLE "settlements" DROP COLUMN IF EXISTS "totalInterest"`);

    // 新增 operationFees 字段
    await queryRunner.query(`ALTER TABLE "settlements" ADD COLUMN "operationFees" DECIMAL(12, 2) NOT NULL DEFAULT 0`);

    // 重命名 settledPrincipal → returnedPrincipal
    await queryRunner.query(`ALTER TABLE "settlements" RENAME COLUMN "settledPrincipal" TO "returnedPrincipal"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========== 4. 还原 settlements 表 ==========
    await queryRunner.query(`ALTER TABLE "settlements" RENAME COLUMN "returnedPrincipal" TO "settledPrincipal"`);
    await queryRunner.query(`ALTER TABLE "settlements" DROP COLUMN IF EXISTS "operationFees"`);
    await queryRunner.query(`ALTER TABLE "settlements" ADD COLUMN "totalInterest" DECIMAL(12, 2) NOT NULL DEFAULT 0`);

    // ========== 3. 还原 drugs 表 ==========
    await queryRunner.query(`ALTER TABLE "drugs" DROP COLUMN IF EXISTS "slowSellingDays"`);
    await queryRunner.query(`ALTER TABLE "drugs" ALTER COLUMN "operationFeeRate" TYPE DECIMAL(10, 2)`);
    await queryRunner.query(`ALTER TABLE "drugs" ALTER COLUMN "operationFeeRate" SET DEFAULT 1.0`);
    await queryRunner.query(`ALTER TABLE "drugs" RENAME COLUMN "operationFeeRate" TO "unitFee"`);
    await queryRunner.query(`ALTER TABLE "drugs" ADD COLUMN "annualRate" DECIMAL(5, 2) NOT NULL DEFAULT 5.0`);
    await queryRunner.query(`ALTER TABLE "drugs" RENAME COLUMN "subscribedQuantity" TO "fundedQuantity"`);

    // ========== 2. 还原 subscription_orders → funding_orders ==========
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_subscription_orders_drugId_status_effectiveAt"`);

    // 删除新增字段
    await queryRunner.query(`ALTER TABLE "subscription_orders" DROP COLUMN IF EXISTS "returnedAt"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" DROP COLUMN IF EXISTS "slowSellingDeadline"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" DROP COLUMN IF EXISTS "effectiveAt"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" DROP COLUMN IF EXISTS "confirmedAt"`);

    // 恢复旧字段
    await queryRunner.query(`ALTER TABLE "subscription_orders" ADD COLUMN "totalInterest" DECIMAL(12, 2) NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" ADD COLUMN "settledAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" ADD COLUMN "fundedAt" TIMESTAMP NOT NULL DEFAULT now()`);

    // 还原约束名
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "PK_subscription_orders" TO "PK_funding_orders"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "UQ_subscription_orders_orderNo" TO "UQ_funding_orders_orderNo"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "FK_subscription_orders_userId" TO "FK_funding_orders_userId"`);
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME CONSTRAINT "FK_subscription_orders_drugId" TO "FK_funding_orders_drugId"`);

    // 重命名表
    await queryRunner.query(`ALTER TABLE "subscription_orders" RENAME TO "funding_orders"`);

    // 恢复旧索引
    await queryRunner.query(`CREATE INDEX "IDX_funding_orders_drugId_status_fundedAt" ON "funding_orders" ("drugId", "status", "fundedAt")`);

    // ========== 1. 还原 pending_orders 表 ==========
    await queryRunner.query(`
      CREATE TABLE "pending_orders" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "orderNo" VARCHAR NOT NULL,
        "userId" UUID NOT NULL,
        "drugId" UUID NOT NULL,
        "type" VARCHAR NOT NULL,
        "targetPrice" DECIMAL(10, 2) NOT NULL,
        "quantity" INTEGER NOT NULL,
        "filledQuantity" INTEGER NOT NULL DEFAULT 0,
        "frozenAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "status" VARCHAR NOT NULL DEFAULT 'pending',
        "expireAt" TIMESTAMP,
        "triggeredAt" TIMESTAMP,
        "fundingOrderId" UUID,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_pending_orders_orderNo" UNIQUE ("orderNo"),
        CONSTRAINT "PK_pending_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pending_orders_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pending_orders_drugId" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_pending_orders_drugId_status_createdAt" ON "pending_orders" ("drugId", "status", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_pending_orders_userId_status" ON "pending_orders" ("userId", "status")`);
  }
}
