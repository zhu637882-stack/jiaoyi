import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPartialConfirmFields1750600000000 implements MigrationInterface {
  name = 'AddPartialConfirmFields1750600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加已确认数量
    await queryRunner.addColumn(
      'subscription_orders',
      new TableColumn({
        name: 'confirmedQuantity',
        type: 'int',
        default: 0,
        comment: '管理员确认数量',
      }),
    );

    // 添加待确认数量
    await queryRunner.addColumn(
      'subscription_orders',
      new TableColumn({
        name: 'unconfirmedQuantity',
        type: 'int',
        default: 0,
        comment: '待确认数量（quantity - confirmedQuantity）',
      }),
    );

    // 添加部分确认时间
    await queryRunner.addColumn(
      'subscription_orders',
      new TableColumn({
        name: 'unconfirmedAt',
        type: 'timestamp',
        isNullable: true,
        comment: '部分确认时间（未确认部分开始计时）',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('subscription_orders', 'unconfirmedAt');
    await queryRunner.dropColumn('subscription_orders', 'unconfirmedQuantity');
    await queryRunner.dropColumn('subscription_orders', 'confirmedQuantity');
  }
}
