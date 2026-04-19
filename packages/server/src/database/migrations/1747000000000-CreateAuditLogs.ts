import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 创建审计日志表 audit_logs
 * 用于记录系统操作日志（登录、调价、撤单、清算、充值、提现、卖出等）
 */
export class CreateAuditLogs1747000000000 implements MigrationInterface {
  name = 'CreateAuditLogs1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "userId" UUID,
        "action" CHARACTER VARYING NOT NULL,
        "targetType" CHARACTER VARYING,
        "targetId" CHARACTER VARYING,
        "detail" TEXT,
        "ipAddress" CHARACTER VARYING,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_userId_createdAt" ON "audit_logs" ("userId", "createdAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_userId_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
  }
}
