import { MigrationInterface, QueryRunner } from 'typeorm';

/** Login OTP is short-lived; store plaintext `code` for DB visibility (dev/support). */
export class OtpCodesPlainTextCode1740000000004 implements MigrationInterface {
  name = 'OtpCodesPlainTextCode1740000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('otp_codes');
    if (!table) return;

    // Ephemeral rows — safe to clear while fixing column name.
    await queryRunner.query(`DELETE FROM "otp_codes"`);

    const hasCodeHash = table.columns.some((c) => c.name === 'codeHash');
    const hasCode = table.columns.some((c) => c.name === 'code');

    if (hasCodeHash && !hasCode) {
      await queryRunner.query(`ALTER TABLE "otp_codes" RENAME COLUMN "codeHash" TO "code"`);
    } else if (!hasCode && !hasCodeHash) {
      // Recovery if a failed TypeORM sync dropped the column mid-transaction.
      await queryRunner.query(`
        ALTER TABLE "otp_codes" ADD "code" character varying NOT NULL DEFAULT '000000'
      `);
      await queryRunner.query(`ALTER TABLE "otp_codes" ALTER COLUMN "code" DROP DEFAULT`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('otp_codes');
    if (!table) return;

    const hasCode = table.columns.some((c) => c.name === 'code');
    const hasCodeHash = table.columns.some((c) => c.name === 'codeHash');

    if (hasCode && !hasCodeHash) {
      await queryRunner.query(`ALTER TABLE "otp_codes" RENAME COLUMN "code" TO "codeHash"`);
    }
  }
}
