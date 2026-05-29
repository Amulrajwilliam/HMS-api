import { MigrationInterface, QueryRunner } from 'typeorm';

export class NursingChartAndEmar1740000000009 implements MigrationInterface {
  name = 'NursingChartAndEmar1740000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nursing_flowsheet_entries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL,
        "recordedByUserId" uuid,
        "shiftLabel" character varying(32),
        "bloodPressure" character varying(32),
        "temperature" numeric(5,2),
        "pulseRate" character varying(16),
        "respiratoryRate" character varying(16),
        "oxygenSaturation" character varying(16),
        "painScore" integer,
        "notes" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nursing_care_plans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL,
        "problem" text NOT NULL,
        "goal" text,
        "intervention" text,
        "status" character varying(16) NOT NULL DEFAULT 'active',
        "createdByUserId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "nursing_ews_scores" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL,
        "totalScore" integer NOT NULL,
        "respiratoryRate" integer,
        "spo2" integer,
        "supplementalO2" boolean NOT NULL DEFAULT false,
        "temperature" numeric(5,2),
        "systolicBp" integer,
        "pulse" integer,
        "consciousness" character varying(8),
        "recordedByUserId" uuid,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "emar_administrations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "patientId" uuid NOT NULL,
        "medicineName" character varying(256) NOT NULL,
        "dose" character varying(128),
        "route" character varying(64),
        "scheduledAt" TIMESTAMP WITH TIME ZONE,
        "administeredAt" TIMESTAMP WITH TIME ZONE,
        "status" character varying(16) NOT NULL DEFAULT 'scheduled',
        "administeredByUserId" uuid,
        "notes" text,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "emar_administrations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nursing_ews_scores"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nursing_care_plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "nursing_flowsheet_entries"`);
  }
}
