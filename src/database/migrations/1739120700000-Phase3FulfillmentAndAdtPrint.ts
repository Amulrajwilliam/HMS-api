import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3FulfillmentAndAdtPrint1739120700000 implements MigrationInterface {
  name = 'Phase3FulfillmentAndAdtPrint1739120700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescription_fulfillments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "medicineName" character varying,
        "quantity" integer NOT NULL DEFAULT 1,
        "dose" character varying,
        "instructions" text,
        "status" character varying NOT NULL DEFAULT 'pending',
        "fulfilledAt" TIMESTAMP,
        "notes" text,
        "patientId" uuid,
        "prescribedById" uuid,
        "medicineId" uuid,
        "fulfilledById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_prescription_fulfillments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_fulfillment_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_fulfillment_prescriber" FOREIGN KEY ("prescribedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_fulfillment_medicine" FOREIGN KEY ("medicineId") REFERENCES "medicines"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_fulfillment_fulfilledby" FOREIGN KEY ("fulfilledById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fulfillment_status" ON "prescription_fulfillments" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_fulfillment_createdAt" ON "prescription_fulfillments" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "prescription_fulfillments"`);
  }
}
