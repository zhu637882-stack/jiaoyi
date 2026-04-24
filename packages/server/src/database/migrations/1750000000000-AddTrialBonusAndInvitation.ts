import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTrialBonusAndInvitation1750000000000 implements MigrationInterface {
  name = 'AddTrialBonusAndInvitation1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== 1. 创建体验金状态枚举 ==========
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "trial_bonus_status_enum" AS ENUM ('pending', 'activated', 'used', 'expired');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // ========== 2. 创建邀请记录状态枚举 ==========
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "invitation_record_status_enum" AS ENUM ('registered', 'subscribed', 'rewarded');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    // ========== 3. 给 account_balances 表添加体验金字段 ==========
    await queryRunner.query(`
      ALTER TABLE "account_balances"
      ADD COLUMN IF NOT EXISTS "trialBalance" DECIMAL(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "trialExpiresAt" TIMESTAMP
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "account_balances"."trialBalance" IS '体验金余额'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "account_balances"."trialExpiresAt" IS '体验金过期时间'
    `);

    // ========== 4. 创建 trial_bonuses 表 ==========
    await queryRunner.query(`
      CREATE TABLE "trial_bonuses" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId" UUID NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL DEFAULT 20,
        "status" "trial_bonus_status_enum" NOT NULL DEFAULT 'pending',
        "activatedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_trial_bonuses" PRIMARY KEY ("id"),
        CONSTRAINT "FK_trial_bonuses_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_trial_bonuses_userId_createdAt" ON "trial_bonuses" ("userId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_trial_bonuses_status" ON "trial_bonuses" ("status")
    `);

    // ========== 5. 创建 invitation_codes 表 ==========
    await queryRunner.query(`
      CREATE TABLE "invitation_codes" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "userId" UUID NOT NULL,
        "code" VARCHAR(6) NOT NULL,
        "usedCount" INTEGER NOT NULL DEFAULT 0,
        "maxUses" INTEGER NOT NULL DEFAULT 50,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invitation_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_invitation_codes_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_invitation_codes_code" UNIQUE ("code"),
        CONSTRAINT "FK_invitation_codes_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invitation_codes_code" ON "invitation_codes" ("code")
    `);

    // ========== 6. 创建 invitation_records 表 ==========
    await queryRunner.query(`
      CREATE TABLE "invitation_records" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "inviterUserId" UUID NOT NULL,
        "inviteeUserId" UUID NOT NULL,
        "invitationCodeId" UUID NOT NULL,
        "status" "invitation_record_status_enum" NOT NULL DEFAULT 'registered',
        "inviterReward" DECIMAL(12, 2) NOT NULL DEFAULT 10,
        "inviteeReward" DECIMAL(12, 2) NOT NULL DEFAULT 5,
        "rewardedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invitation_records" PRIMARY KEY ("id"),
        CONSTRAINT "FK_invitation_records_inviterUserId" FOREIGN KEY ("inviterUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invitation_records_inviteeUserId" FOREIGN KEY ("inviteeUserId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_invitation_records_invitationCodeId" FOREIGN KEY ("invitationCodeId") REFERENCES "invitation_codes"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_invitation_records_inviterUserId_status" ON "invitation_records" ("inviterUserId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_invitation_records_inviteeUserId_status" ON "invitation_records" ("inviteeUserId", "status")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_invitation_records_invitationCodeId" ON "invitation_records" ("invitationCodeId")
    `);

    // ========== 7. 扩展交易类型枚举 ==========
    await queryRunner.query(`
      ALTER TYPE "account_transaction_type_enum" ADD VALUE IF NOT EXISTS 'trial_bonus_grant'
    `);
    await queryRunner.query(`
      ALTER TYPE "account_transaction_type_enum" ADD VALUE IF NOT EXISTS 'trial_bonus_activate'
    `);
    await queryRunner.query(`
      ALTER TYPE "account_transaction_type_enum" ADD VALUE IF NOT EXISTS 'trial_bonus_expire'
    `);
    await queryRunner.query(`
      ALTER TYPE "account_transaction_type_enum" ADD VALUE IF NOT EXISTS 'trial_bonus_use'
    `);
    await queryRunner.query(`
      ALTER TYPE "account_transaction_type_enum" ADD VALUE IF NOT EXISTS 'trial_bonus_return'
    `);
    await queryRunner.query(`
      ALTER TYPE "account_transaction_type_enum" ADD VALUE IF NOT EXISTS 'invitation_reward'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ========== 7. 删除 invitation_records 表相关 ==========
    await queryRunner.query(`DROP INDEX "IDX_invitation_records_invitationCodeId"`);
    await queryRunner.query(`DROP INDEX "IDX_invitation_records_inviteeUserId_status"`);
    await queryRunner.query(`DROP INDEX "IDX_invitation_records_inviterUserId_status"`);
    await queryRunner.query(`DROP TABLE "invitation_records"`);

    // ========== 6. 删除 invitation_codes 表相关 ==========
    await queryRunner.query(`DROP INDEX "IDX_invitation_codes_code"`);
    await queryRunner.query(`DROP TABLE "invitation_codes"`);

    // ========== 5. 删除 trial_bonuses 表相关 ==========
    await queryRunner.query(`DROP INDEX "IDX_trial_bonuses_status"`);
    await queryRunner.query(`DROP INDEX "IDX_trial_bonuses_userId_createdAt"`);
    await queryRunner.query(`DROP TABLE "trial_bonuses"`);

    // ========== 4. 删除 account_balances 新增字段 ==========
    await queryRunner.query(`
      ALTER TABLE "account_balances"
      DROP COLUMN IF EXISTS "trialExpiresAt",
      DROP COLUMN IF EXISTS "trialBalance"
    `);

    // ========== 2 & 1. 删除枚举类型 ==========
    await queryRunner.query(`DROP TYPE IF EXISTS "invitation_record_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "trial_bonus_status_enum"`);

    // 注意：account_transaction_type_enum 的新增值无法单独删除，此处不做回滚
  }
}
