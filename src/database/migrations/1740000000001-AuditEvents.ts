import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditEvents1740000000001 implements MigrationInterface {
  name = 'AuditEvents1740000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "userId" uuid,
        "userEmail" character varying(255),
        "role" character varying(32),
        "method" character varying(8) NOT NULL,
        "path" character varying(2048) NOT NULL,
        "ip" character varying(128),
        "durationMs" integer NOT NULL DEFAULT 0,
        "outcome" character varying(16) NOT NULL DEFAULT 'success',
        "errorSummary" character varying(512),
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_audit_events_createdAt" ON "audit_events" ("createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_events"`);
  }
}
