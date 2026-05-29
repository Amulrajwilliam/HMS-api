import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * B-tree indexes for analytics / list / calendar hot paths (Phase 5).
 * Safe to re-run: IF NOT EXISTS.
 */
export class Phase5AnalyticsIndexes1739121100000 implements MigrationInterface {
  name = 'Phase5AnalyticsIndexes1739121100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_appointments_date" ON "appointments" ("date")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_appointments_status" ON "appointments" ("status")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_appointments_doctorId_date" ON "appointments" ("doctorId", "date")`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_appointments_patientId" ON "appointments" ("patientId")`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patients_status" ON "patients" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_patients_createdAt" ON "patients" ("createdAt")`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_createdAt" ON "invoices" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_status" ON "invoices" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_invoices_patientId" ON "invoices" ("patientId")`);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lab_orders_createdAt" ON "lab_orders" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lab_orders_status" ON "lab_orders" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_lab_orders_patientId" ON "lab_orders" ("patientId")`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_emr_records_patientId_createdAt" ON "emr_records" ("patientId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_emr_records_patientId_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_orders_patientId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_orders_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_lab_orders_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_patientId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_patients_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_patientId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_doctorId_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_appointments_date"`);
  }
}
