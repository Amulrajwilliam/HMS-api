import { MigrationInterface, QueryRunner } from 'typeorm';

export class FrontDeskQueueWaitlistMpi1740000000011 implements MigrationInterface {
  name = 'FrontDeskQueueWaitlistMpi1740000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "visit_check_ins_status_enum" AS ENUM (
          'waiting', 'called', 'in_service', 'completed', 'no_show'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "visit_check_ins" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "tokenNumber" character varying(16) NOT NULL,
        "queueDate" date NOT NULL,
        "department" character varying(64) NOT NULL DEFAULT 'OPD',
        "status" "visit_check_ins_status_enum" NOT NULL DEFAULT 'waiting',
        "appointmentId" uuid NULL,
        "patientId" uuid NOT NULL,
        "doctorId" uuid NULL,
        "checkedInAt" TIMESTAMPTZ NULL,
        "calledAt" TIMESTAMPTZ NULL,
        "completedAt" TIMESTAMPTZ NULL,
        "createdById" uuid NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_visit_check_ins_appointment" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_visit_check_ins_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_visit_check_ins_doctor" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_visit_check_ins_created_by" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_visit_check_ins_queue"
      ON "visit_check_ins" ("queueDate", "department", "status")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "appointment_waitlist_status_enum" AS ENUM (
          'waiting', 'notified', 'booked', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "appointment_waitlist" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "patientId" uuid NOT NULL,
        "doctorId" uuid NOT NULL,
        "department" character varying(64) NULL,
        "preferredDate" date NULL,
        "priority" integer NOT NULL DEFAULT 0,
        "status" "appointment_waitlist_status_enum" NOT NULL DEFAULT 'waiting',
        "notes" text NULL,
        "lastNotifiedAt" TIMESTAMPTZ NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_waitlist_patient" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_waitlist_doctor" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reminder_campaign_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "campaignType" character varying(48) NOT NULL,
        "recipientCount" integer NOT NULL DEFAULT 0,
        "skippedCount" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NULL,
        "ranById" uuid NULL,
        "ranAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_reminder_campaign_ran_by" FOREIGN KEY ("ranById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "patient_merge_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "survivorPatientId" uuid NOT NULL,
        "mergedPatientId" uuid NOT NULL,
        "mergedUhid" character varying(32) NOT NULL,
        "mergedSnapshot" jsonb NULL,
        "mergedById" uuid NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "FK_merge_survivor" FOREIGN KEY ("survivorPatientId") REFERENCES "patients"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_merge_by" FOREIGN KEY ("mergedById") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "patient_merge_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reminder_campaign_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "appointment_waitlist"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "visit_check_ins"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "appointment_waitlist_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "visit_check_ins_status_enum"`);
  }
}
