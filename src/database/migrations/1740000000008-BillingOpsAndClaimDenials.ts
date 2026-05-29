import { MigrationInterface, QueryRunner } from 'typeorm';

export class BillingOpsAndClaimDenials1740000000008 implements MigrationInterface {
  name = 'BillingOpsAndClaimDenials1740000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "insurance_claims"
      ADD COLUMN IF NOT EXISTS "denialReason" character varying(512),
      ADD COLUMN IF NOT EXISTS "appealNotes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "insurance_claims"
      DROP COLUMN IF EXISTS "appealNotes",
      DROP COLUMN IF EXISTS "denialReason"
    `);
  }
}
