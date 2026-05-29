import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2LabTestsAndReports1739120500000 implements MigrationInterface {
  name = 'Phase2LabTestsAndReports1739120500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lab_tests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "sampleTypeHint" character varying,
        "department" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lab_tests_code" UNIQUE ("code"),
        CONSTRAINT "PK_lab_tests" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "lab_orders" ADD COLUMN IF NOT EXISTS "sampleBarcode" character varying
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "medical_reports_reporttype_enum" AS ENUM ('lab_pdf', 'radiology', 'dicom', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "medical_reports_storageprovider_enum" AS ENUM ('local', 's3');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "medical_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "title" character varying NOT NULL,
        "reportType" "medical_reports_reporttype_enum" NOT NULL DEFAULT 'other',
        "storageProvider" "medical_reports_storageprovider_enum" NOT NULL,
        "storageKey" character varying NOT NULL,
        "s3Bucket" character varying,
        "originalFilename" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "fileSize" bigint NOT NULL DEFAULT 0,
        "patientId" uuid,
        "uploadedById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_medical_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_medical_reports_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_medical_reports_user" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_medical_reports_createdAt" ON "medical_reports" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "medical_reports"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "medical_reports_storageprovider_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "medical_reports_reporttype_enum"`);
    await queryRunner.query(`ALTER TABLE "lab_orders" DROP COLUMN IF EXISTS "sampleBarcode"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_tests"`);
  }
}
