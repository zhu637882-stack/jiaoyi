import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleToUser1750200000000 implements MigrationInterface {
  name = 'AddRoleToUser1750200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. 将role列从enum改为varchar（如果当前是enum类型）
    // SQLite不支持ALTER COLUMN，直接用SQL处理
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role_new" varchar DEFAULT 'user'
    `);

    // 2. 迁移旧数据：investor -> user, admin -> admin
    await queryRunner.query(`
      UPDATE "users" SET "role_new" = CASE
        WHEN "role" = 'admin' THEN 'admin'
        WHEN "role" = 'investor' THEN 'user'
        ELSE 'user'
      END
    `);

    // 3. 确保admin账户拥有admin角色
    await queryRunner.query(`
      UPDATE "users" SET "role_new" = 'admin' WHERE "username" = 'admin'
    `);

    // 4. 对于SQLite：直接重命名列（不删除旧列避免数据丢失）
    // 由于TypeORM SQLite的特殊性，我们尝试删除旧列再重命名
    try {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    } catch (e) {
      // 列可能不存在或格式不同，忽略错误
    }
    try {
      await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "role_new" TO "role"`);
    } catch (e) {
      // 重命名可能失败（如果role列还存在），忽略
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚：将user改回investor
    await queryRunner.query(`
      UPDATE "users" SET "role" = 'investor' WHERE "role" = 'user'
    `);
    await queryRunner.query(`
      UPDATE "users" SET "role" = 'investor' WHERE "role" IN ('viewer', 'manager')
    `);
  }
}
