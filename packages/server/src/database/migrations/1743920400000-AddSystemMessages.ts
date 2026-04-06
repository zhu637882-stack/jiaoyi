import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemMessages1743920400000 implements MigrationInterface {
  name = 'AddSystemMessages1743920400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 创建 message_type_enum 类型
    await queryRunner.query(`
      CREATE TYPE "message_type_enum" AS ENUM ('announcement', 'notification', 'maintenance')
    `);

    // 创建 message_status_enum 类型
    await queryRunner.query(`
      CREATE TYPE "message_status_enum" AS ENUM ('draft', 'published', 'archived')
    `);

    // 创建 system_messages 表
    await queryRunner.query(`
      CREATE TABLE "system_messages" (
        "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
        "title" VARCHAR NOT NULL,
        "content" TEXT NOT NULL,
        "type" "message_type_enum" NOT NULL DEFAULT 'announcement',
        "status" "message_status_enum" NOT NULL DEFAULT 'draft',
        "publishedBy" UUID,
        "publishedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_system_messages" PRIMARY KEY ("id")
      )
    `);

    // 创建索引
    await queryRunner.query(`
      CREATE INDEX "IDX_system_messages_status_createdAt" ON "system_messages" ("status", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 删除索引
    await queryRunner.query(`DROP INDEX "IDX_system_messages_status_createdAt"`);

    // 删除表
    await queryRunner.query(`DROP TABLE "system_messages"`);

    // 删除枚举类型
    await queryRunner.query(`DROP TYPE "message_status_enum"`);
    await queryRunner.query(`DROP TYPE "message_type_enum"`);
  }
}
