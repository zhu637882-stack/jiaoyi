import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLoginCountToUser1750100000000 implements MigrationInterface {
  name = 'AddLoginCountToUser1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "loginCount" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "loginCount"
    `);
  }
}
