import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3EmrFulfillmentLink1739120800000 implements MigrationInterface {
  name = 'Phase3EmrFulfillmentLink1739120800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "prescription_fulfillments"
      ADD COLUMN IF NOT EXISTS "sourceEmrRecordId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fulfillment_source_emr" ON "prescription_fulfillments" ("sourceEmrRecordId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fulfillment_source_emr"`);
    await queryRunner.query(`
      ALTER TABLE "prescription_fulfillments"
      DROP COLUMN IF EXISTS "sourceEmrRecordId"
    `);
  }
}

