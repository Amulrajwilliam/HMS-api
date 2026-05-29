import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminSecurityAndMasters1740000000003 implements MigrationInterface {
  name = 'AdminSecurityAndMasters1740000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "users" ADD COLUMN "totpSecret" character varying(128);
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "users" ADD COLUMN "totpEnabled" boolean NOT NULL DEFAULT false;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(128) NOT NULL,
        "code" character varying(32) NOT NULL,
        "description" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_departments_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billable_services" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(64) NOT NULL,
        "name" character varying(256) NOT NULL,
        "description" text,
        "defaultPrice" numeric(12,2) NOT NULL DEFAULT 0,
        "departmentId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billable_services" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_billable_services_code" UNIQUE ("code"),
        CONSTRAINT "FK_billable_services_department" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "doctor_profiles" ADD COLUMN "departmentId" uuid;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "doctor_profiles" ADD COLUMN "credentialingStatus" character varying(32) NOT NULL DEFAULT 'none';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "doctor_profiles" ADD COLUMN "credentialingNotes" text;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "doctor_profiles" ADD COLUMN "credentialingReviewedAt" TIMESTAMP;
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "doctor_profiles"
        ADD CONSTRAINT "FK_doctor_profiles_department"
        FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP CONSTRAINT IF EXISTS "FK_doctor_profiles_department"`);
    await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN IF EXISTS "credentialingReviewedAt"`);
    await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN IF EXISTS "credentialingNotes"`);
    await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN IF EXISTS "credentialingStatus"`);
    await queryRunner.query(`ALTER TABLE "doctor_profiles" DROP COLUMN IF EXISTS "departmentId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "billable_services"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totpEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "totpSecret"`);
  }
}
