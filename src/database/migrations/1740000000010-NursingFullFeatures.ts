import { MigrationInterface, QueryRunner } from 'typeorm';

export class NursingFullFeatures1740000000010 implements MigrationInterface {
  name = 'NursingFullFeatures1740000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "emar_administrations"
      ADD COLUMN IF NOT EXISTS "prescriptionFulfillmentId" uuid NULL,
      ADD COLUMN IF NOT EXISTS "sourceEmrRecordId" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "nursing_ews_scores"
      ADD COLUMN IF NOT EXISTS "riskBand" character varying(16) NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_emar_patient_fulfillment"
      ON "emar_administrations" ("patientId", "prescriptionFulfillmentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_emar_patient_fulfillment"`);
    await queryRunner.query(`ALTER TABLE "nursing_ews_scores" DROP COLUMN IF EXISTS "riskBand"`);
    await queryRunner.query(`
      ALTER TABLE "emar_administrations"
      DROP COLUMN IF EXISTS "sourceEmrRecordId",
      DROP COLUMN IF EXISTS "prescriptionFulfillmentId"
    `);
  }
}
