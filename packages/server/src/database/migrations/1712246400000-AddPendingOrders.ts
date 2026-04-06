import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingOrders1712246400000 implements MigrationInterface {
  name = 'AddPendingOrders1712246400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 pending_orders 表
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

    // 创建 pending_orders 联合索引
    await queryRunner.query(`
      CREATE INDEX "IDX_pending_orders_drugId_status_createdAt" ON "pending_orders" ("drugId", "status", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_pending_orders_userId_status" ON "pending_orders" ("userId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.query(`DROP INDEX "IDX_pending_orders_userId_status"`);
    await queryRunner.query(`DROP INDEX "IDX_pending_orders_drugId_status_createdAt"`);

    // 删除表
    await queryRunner.query(`DROP TABLE "pending_orders"`);
  }
}
