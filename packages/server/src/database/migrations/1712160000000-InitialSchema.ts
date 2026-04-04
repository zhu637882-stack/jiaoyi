import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1712160000000 implements MigrationInterface {
  name = 'InitialSchema1712160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 uuid-ossp 扩展（用于 uuid_generate_v4()）
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // 1. 创建 users 表
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "username" VARCHAR NOT NULL,
        "password" VARCHAR NOT NULL,
        "role" VARCHAR NOT NULL DEFAULT 'investor',
        "realName" VARCHAR,
        "phone" VARCHAR,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // 2. 创建 drugs 表
    await queryRunner.query(`
      CREATE TABLE "drugs" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "name" VARCHAR NOT NULL,
        "code" VARCHAR NOT NULL,
        "purchasePrice" DECIMAL(10, 2) NOT NULL,
        "sellingPrice" DECIMAL(10, 2) NOT NULL,
        "totalQuantity" INTEGER NOT NULL,
        "fundedQuantity" INTEGER NOT NULL DEFAULT 0,
        "batchNo" VARCHAR NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'pending',
        "annualRate" DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
        "unitFee" DECIMAL(10, 2) NOT NULL DEFAULT 1.0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_drugs_code" UNIQUE ("code"),
        CONSTRAINT "PK_drugs" PRIMARY KEY ("id")
      )
    `);

    // 3. 创建 funding_orders 表
    await queryRunner.query(`
      CREATE TABLE "funding_orders" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "orderNo" VARCHAR NOT NULL,
        "userId" UUID NOT NULL,
        "drugId" UUID NOT NULL,
        "quantity" INTEGER NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL,
        "settledQuantity" INTEGER NOT NULL DEFAULT 0,
        "unsettledAmount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "status" VARCHAR NOT NULL DEFAULT 'pending',
        "queuePosition" INTEGER NOT NULL,
        "fundedAt" TIMESTAMP NOT NULL,
        "settledAt" TIMESTAMP,
        "totalProfit" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "totalLoss" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "totalInterest" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_funding_orders_orderNo" UNIQUE ("orderNo"),
        CONSTRAINT "PK_funding_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_funding_orders_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_funding_orders_drugId" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE CASCADE
      )
    `);

    // 创建 funding_orders 联合索引
    await queryRunner.query(`
      CREATE INDEX "IDX_funding_orders_drugId_status_fundedAt" ON "funding_orders" ("drugId", "status", "fundedAt")
    `);

    // 4. 创建 daily_sales 表
    await queryRunner.query(`
      CREATE TABLE "daily_sales" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "drugId" UUID NOT NULL,
        "saleDate" DATE NOT NULL,
        "quantity" INTEGER NOT NULL,
        "actualSellingPrice" DECIMAL(10, 2) NOT NULL,
        "totalRevenue" DECIMAL(12, 2) NOT NULL,
        "terminal" VARCHAR NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_sales" PRIMARY KEY ("id"),
        CONSTRAINT "FK_daily_sales_drugId" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE CASCADE
      )
    `);

    // 创建 daily_sales 联合索引
    await queryRunner.query(`
      CREATE INDEX "IDX_daily_sales_drugId_saleDate" ON "daily_sales" ("drugId", "saleDate")
    `);

    // 5. 创建 settlements 表
    await queryRunner.query(`
      CREATE TABLE "settlements" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "drugId" UUID NOT NULL,
        "settlementDate" DATE NOT NULL,
        "totalSalesRevenue" DECIMAL(12, 2) NOT NULL,
        "totalCost" DECIMAL(12, 2) NOT NULL,
        "totalFees" DECIMAL(12, 2) NOT NULL,
        "totalInterest" DECIMAL(12, 2) NOT NULL,
        "netProfit" DECIMAL(12, 2) NOT NULL,
        "investorProfitShare" DECIMAL(12, 2) NOT NULL,
        "platformProfitShare" DECIMAL(12, 2) NOT NULL,
        "investorLossShare" DECIMAL(12, 2) NOT NULL,
        "platformLossShare" DECIMAL(12, 2) NOT NULL,
        "settledPrincipal" DECIMAL(12, 2) NOT NULL,
        "settledOrderCount" INTEGER NOT NULL,
        "status" VARCHAR NOT NULL DEFAULT 'processing',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_settlements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_settlements_drugId" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE CASCADE
      )
    `);

    // 创建 settlements 联合索引
    await queryRunner.query(`
      CREATE INDEX "IDX_settlements_drugId_settlementDate" ON "settlements" ("drugId", "settlementDate")
    `);

    // 6. 创建 account_balances 表
    await queryRunner.query(`
      CREATE TABLE "account_balances" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId" UUID NOT NULL,
        "availableBalance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "frozenBalance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "totalProfit" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "totalInvested" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_account_balances_userId" UNIQUE ("userId"),
        CONSTRAINT "PK_account_balances" PRIMARY KEY ("id"),
        CONSTRAINT "FK_account_balances_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 7. 创建 account_transactions 表
    await queryRunner.query(`
      CREATE TABLE "account_transactions" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId" UUID NOT NULL,
        "type" VARCHAR NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL,
        "balanceBefore" DECIMAL(12, 2) NOT NULL,
        "balanceAfter" DECIMAL(12, 2) NOT NULL,
        "relatedOrderId" UUID,
        "relatedSettlementId" UUID,
        "description" VARCHAR NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_transactions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_account_transactions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 创建 account_transactions 联合索引
    await queryRunner.query(`
      CREATE INDEX "IDX_account_transactions_userId_createdAt" ON "account_transactions" ("userId", "createdAt")
    `);

    // 8. 创建 payment_orders 表
    await queryRunner.query(`CREATE TYPE "payment_channel_enum" AS ENUM ('alipay', 'wechat')`);
    await queryRunner.query(`CREATE TYPE "payment_status_enum" AS ENUM ('pending', 'paid', 'failed', 'expired')`);
    await queryRunner.query(`
      CREATE TABLE "payment_orders" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId" UUID NOT NULL,
        "outTradeNo" VARCHAR(64) NOT NULL,
        "channel" "payment_channel_enum" NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL,
        "status" "payment_status_enum" NOT NULL DEFAULT 'pending',
        "tradeNo" VARCHAR(64),
        "paidAt" TIMESTAMP,
        "notifyData" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payment_orders_outTradeNo" UNIQUE ("outTradeNo"),
        CONSTRAINT "PK_payment_orders" PRIMARY KEY ("id"),
        CONSTRAINT "FK_payment_orders_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // 创建 payment_orders 索引
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_orders_userId_createdAt" ON "payment_orders" ("userId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_payment_orders_outTradeNo" ON "payment_orders" ("outTradeNo")
    `);

    // 9. 创建 market_snapshots 表
    await queryRunner.query(`
      CREATE TABLE "market_snapshots" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "drugId" UUID NOT NULL,
        "snapshotDate" DATE NOT NULL,
        "dailySalesQuantity" INTEGER NOT NULL,
        "dailySalesRevenue" DECIMAL(12, 2) NOT NULL,
        "averageSellingPrice" DECIMAL(10, 2) NOT NULL,
        "dailyReturn" DECIMAL(8, 4) NOT NULL,
        "cumulativeReturn" DECIMAL(8, 4) NOT NULL,
        "totalFundingAmount" DECIMAL(12, 2) NOT NULL,
        "fundingHeat" INTEGER NOT NULL,
        "queueDepth" INTEGER NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_market_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_market_snapshots_drugId" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE CASCADE
      )
    `);

    // 创建 market_snapshots 联合索引
    await queryRunner.query(`
      CREATE INDEX "IDX_market_snapshots_drugId_snapshotDate" ON "market_snapshots" ("drugId", "snapshotDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 按依赖关系反序删除表

    // 9. 删除 market_snapshots 表
    await queryRunner.query(`DROP INDEX "IDX_market_snapshots_drugId_snapshotDate"`);
    await queryRunner.query(`DROP TABLE "market_snapshots"`);

    // 8. 删除 payment_orders 表
    await queryRunner.query(`DROP INDEX "IDX_payment_orders_outTradeNo"`);
    await queryRunner.query(`DROP INDEX "IDX_payment_orders_userId_createdAt"`);
    await queryRunner.query(`DROP TABLE "payment_orders"`);
    await queryRunner.query(`DROP TYPE "payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "payment_channel_enum"`);

    // 7. 删除 account_transactions 表
    await queryRunner.query(`DROP INDEX "IDX_account_transactions_userId_createdAt"`);
    await queryRunner.query(`DROP TABLE "account_transactions"`);

    // 6. 删除 account_balances 表
    await queryRunner.query(`DROP TABLE "account_balances"`);

    // 5. 删除 settlements 表
    await queryRunner.query(`DROP INDEX "IDX_settlements_drugId_settlementDate"`);
    await queryRunner.query(`DROP TABLE "settlements"`);

    // 4. 删除 daily_sales 表
    await queryRunner.query(`DROP INDEX "IDX_daily_sales_drugId_saleDate"`);
    await queryRunner.query(`DROP TABLE "daily_sales"`);

    // 3. 删除 funding_orders 表
    await queryRunner.query(`DROP INDEX "IDX_funding_orders_drugId_status_fundedAt"`);
    await queryRunner.query(`DROP TABLE "funding_orders"`);

    // 2. 删除 drugs 表
    await queryRunner.query(`DROP TABLE "drugs"`);

    // 1. 删除 users 表
    await queryRunner.query(`DROP TABLE "users"`);

    // 删除 uuid-ossp 扩展（可选）
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
