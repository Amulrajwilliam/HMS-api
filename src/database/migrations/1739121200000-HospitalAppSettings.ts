import { MigrationInterface, QueryRunner } from 'typeorm';

export class HospitalAppSettings1739121200000 implements MigrationInterface {
  name = 'HospitalAppSettings1739121200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "hospital_app_settings" (
        "id" character varying(32) NOT NULL DEFAULT 'singleton',
        "settings" jsonb NOT NULL DEFAULT '{}',
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hospital_app_settings" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "hospital_app_settings"`);
  }
}
