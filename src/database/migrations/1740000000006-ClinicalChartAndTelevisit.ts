import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClinicalChartAndTelevisit1740000000006 implements MigrationInterface {
  name = 'ClinicalChartAndTelevisit1740000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "patient_problems_status_enum" AS ENUM ('active', 'resolved');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "patient_allergies_status_enum" AS ENUM ('active', 'unconfirmed', 'refuted');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "patient_allergies_source_enum" AS ENUM ('patient_reported', 'clinician', 'imported');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_problems" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL,
        "icdCode" character varying(32),
        "description" text NOT NULL,
        "status" "patient_problems_status_enum" NOT NULL DEFAULT 'active',
        "onsetDate" date,
        "createdByUserId" uuid,
        "resolvedAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patient_problems" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patient_problems_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patient_problems_patient" ON "patient_problems" ("patientId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_allergies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL,
        "substance" character varying(256) NOT NULL,
        "reaction" text,
        "severity" character varying(32),
        "status" "patient_allergies_status_enum" NOT NULL DEFAULT 'active',
        "source" "patient_allergies_source_enum" NOT NULL DEFAULT 'clinician',
        "reconciledAt" TIMESTAMP WITH TIME ZONE,
        "reconciledByUserId" uuid,
        "recordedByUserId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_patient_allergies" PRIMARY KEY ("id"),
        CONSTRAINT "FK_patient_allergies_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_patient_allergies_patient" ON "patient_allergies" ("patientId")
    `);

    await queryRunner.query(`
      ALTER TYPE "appointments_type_enum" ADD VALUE IF NOT EXISTS 'televisit'
    `).catch(async () => {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE "appointments_type_enum" ADD VALUE 'televisit';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `).catch(() => undefined);
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_allergies"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_problems"`);
  }
}
