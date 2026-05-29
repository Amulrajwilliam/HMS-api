import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorProfiles1740000000000 implements MigrationInterface {
  name = 'DoctorProfiles1740000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "doctor_profiles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "medicalRegistrationNo" character varying(64),
        "registrationExpiry" date,
        "specialties" character varying(512),
        "qualification" character varying(256),
        "department" character varying(128),
        "consultationFee" numeric(12,2),
        "languages" character varying(256),
        "bio" text,
        "employeeId" character varying(64),
        "designation" character varying(128),
        "clinicalPhone" character varying(32),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_doctor_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_doctor_profiles_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_doctor_profiles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_doctor_profiles_department" ON "doctor_profiles" ("department")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_profiles"`);
  }
}
