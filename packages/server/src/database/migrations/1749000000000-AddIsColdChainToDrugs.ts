import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsColdChainToDrugs1749000000000 implements MigrationInterface {
  name = 'AddIsColdChainToDrugs1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'drugs',
      new TableColumn({
        name: 'isColdChain',
        type: 'boolean',
        default: false,
        comment: '是否冷链药品（冷链快递费20元，普通3元）',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('drugs', 'isColdChain');
  }
}
