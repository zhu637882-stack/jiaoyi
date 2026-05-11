import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddImageUrlToDrugs1750400000000 implements MigrationInterface {
  name = 'AddImageUrlToDrugs1750400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'drugs',
      new TableColumn({
        name: 'imageUrl',
        type: 'character varying',
        isNullable: true,
        comment: '产品图片URL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('drugs', 'imageUrl');
  }
}
