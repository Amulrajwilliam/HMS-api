import { MigrationInterface, QueryRunner } from 'typeorm';

export class DoctorScheduleAndTelevisitFields1740000000007 implements MigrationInterface {
  name = 'DoctorScheduleAndTelevisitFields1740000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      ADD COLUMN IF NOT EXISTS "clinicStartTime" character varying(8) DEFAULT '09:00',
      ADD COLUMN IF NOT EXISTS "clinicEndTime" character varying(8) DEFAULT '17:00',
      ADD COLUMN IF NOT EXISTS "slotDurationMinutes" integer DEFAULT 30,
      ADD COLUMN IF NOT EXISTS "workingDays" character varying(32) DEFAULT '1,2,3,4,5'
    `);

    await queryRunner.query(`
      ALTER TABLE "appointments"
      ADD COLUMN IF NOT EXISTS "televisitUrl" character varying(512),
      ADD COLUMN IF NOT EXISTS "televisitInstructions" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "appointments"
      DROP COLUMN IF EXISTS "televisitInstructions",
      DROP COLUMN IF EXISTS "televisitUrl"
    `);
    await queryRunner.query(`
      ALTER TABLE "doctor_profiles"
      DROP COLUMN IF EXISTS "workingDays",
      DROP COLUMN IF EXISTS "slotDurationMinutes",
      DROP COLUMN IF EXISTS "clinicEndTime",
      DROP COLUMN IF EXISTS "clinicStartTime"
    `);
  }
}
