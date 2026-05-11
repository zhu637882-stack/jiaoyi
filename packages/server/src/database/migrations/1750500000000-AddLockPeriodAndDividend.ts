import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLockPeriodAndDividend1750500000000 implements MigrationInterface {
  name = 'AddLockPeriodAndDividend1750500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 添加锁定期截止日
    await queryRunner.addColumn(
      'subscription_orders',
      new TableColumn({
        name: 'lockExpiresAt',
        type: 'timestamp',
        isNullable: true,
        comment: '锁定期截止日（effectiveAt + 10天）',
      }),
    );

    // 添加分红金额
    await queryRunner.addColumn(
      'subscription_orders',
      new TableColumn({
        name: 'dividendAmount',
        type: 'decimal',
        precision: 12,
        scale: 2,
        default: 0,
        comment: '分红金额（财务手动填写）',
      }),
    );

    // 添加填写分红的管理员
    await queryRunner.addColumn(
      'subscription_orders',
      new TableColumn({
        name: 'dividendFilledBy',
        type: 'varchar',
        isNullable: true,
        comment: '填写分红的管理员',
      }),
    );

    // 添加分红填写时间
    await queryRunner.addColumn(
      'subscription_orders',
      new TableColumn({
        name: 'dividendFilledAt',
        type: 'timestamp',
        isNullable: true,
        comment: '分红填写时间',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('subscription_orders', 'dividendFilledAt');
    await queryRunner.dropColumn('subscription_orders', 'dividendFilledBy');
    await queryRunner.dropColumn('subscription_orders', 'dividendAmount');
    await queryRunner.dropColumn('subscription_orders', 'lockExpiresAt');
  }
}
