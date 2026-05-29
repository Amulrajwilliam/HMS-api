import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdtWardsBedsAdmissions1739121200000 implements MigrationInterface {
  name = 'AdtWardsBedsAdmissions1739121200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "wards_type_enum" AS ENUM (
          'general', 'icu', 'emergency', 'pediatric', 'maternity', 'surgical', 'orthopedic'
        );
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "beds_status_enum" AS ENUM ('available', 'occupied', 'maintenance', 'reserved');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "admissions_status_enum" AS ENUM ('admitted', 'transferred', 'discharged');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "wards" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "type" "wards_type_enum" NOT NULL DEFAULT 'general',
        "floor" character varying NOT NULL,
        "totalBeds" integer NOT NULL DEFAULT 0,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_wards" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "beds" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "bedNumber" character varying NOT NULL,
        "status" "beds_status_enum" NOT NULL DEFAULT 'available',
        "pricePerDay" numeric(8,2) NOT NULL DEFAULT 0,
        "bedType" character varying,
        "wardId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_beds" PRIMARY KEY ("id"),
        CONSTRAINT "FK_beds_ward" FOREIGN KEY ("wardId") REFERENCES "wards"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "admittedAt" TIMESTAMP NOT NULL,
        "dischargedAt" TIMESTAMP,
        "admissionDiagnosis" text,
        "dischargeSummary" text,
        "notes" text,
        "status" "admissions_status_enum" NOT NULL DEFAULT 'admitted',
        "patientId" uuid NOT NULL,
        "bedId" uuid NOT NULL,
        "admittingDoctorId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admissions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_admissions_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_admissions_bed" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_admissions_doctor" FOREIGN KEY ("admittingDoctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admissions_status" ON "admissions" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admissions_patientId" ON "admissions" ("patientId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_beds_status" ON "beds" ("status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "beds"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "wards"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "admissions_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "beds_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "wards_type_enum"`);
  }
}
