import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4NotificationTemplates1739120900000 implements MigrationInterface {
  name = 'Phase4NotificationTemplates1739120900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(120) NOT NULL,
        "titleTemplate" character varying(200) NOT NULL,
        "messageTemplate" text NOT NULL,
        "defaultType" character varying NOT NULL DEFAULT 'info',
        "defaultModule" character varying NOT NULL DEFAULT 'system',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_notification_templates_key" UNIQUE ("key"),
        CONSTRAINT "PK_notification_templates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notification_templates_key" ON "notification_templates" ("key")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_templates"`);
  }
}
