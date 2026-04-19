import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建日收益表 daily_yields
 * 用于记录每个认购订单每天的基础收益（5%年化）和补贴金
 */
export class CreateDailyYields1746000000000 implements MigrationInterface {
  name = 'CreateDailyYields1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "daily_yields" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "orderId" UUID NOT NULL,
        "userId" UUID NOT NULL,
        "drugId" UUID NOT NULL,
        "yieldDate" DATE NOT NULL,
        "baseYield" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "subsidy" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "totalYield" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "principalBalance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "cumulativeYield" DECIMAL(12, 2) NOT NULL DEFAULT 0,
        "subsidyFilled" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_daily_yields_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_daily_yields_order" FOREIGN KEY ("orderId") REFERENCES "subscription_orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_daily_yields_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_daily_yields_drug" FOREIGN KEY ("drugId") REFERENCES "drugs"("id") ON DELETE CASCADE
      )
    `);

    // 唯一约束：同一订单同一天只有一条收益记录
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_daily_yields_order_date" ON "daily_yields" ("orderId", "yieldDate")
    `);

    // 按用户+日期查询（客户查看自己的收益曲线）
    await queryRunner.query(`
      CREATE INDEX "IDX_daily_yields_user_date" ON "daily_yields" ("userId", "yieldDate")
    `);

    // 按药品+日期查询（管理员查看某药品所有客户收益）
    await queryRunner.query(`
      CREATE INDEX "IDX_daily_yields_drug_date" ON "daily_yields" ("drugId", "yieldDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_daily_yields_drug_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_daily_yields_user_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_daily_yields_order_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "daily_yields"`);
  }
}
