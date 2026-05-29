import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase1OtpCodesAndPatientUserId1739120400000 implements MigrationInterface {
  name = 'Phase1OtpCodesAndPatientUserId1739120400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otp_codes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "codeHash" character varying NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_otp_codes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_otp_codes_email_createdAt"
      ON "otp_codes" ("email", "createdAt")
    `);

    await queryRunner.query(`
      ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "userId" uuid
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_patients_userId"
      ON "patients" ("userId")
      WHERE "userId" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_patients_userId"`);
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "otp_codes"`);
  }
}
