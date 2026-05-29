import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserPushDevices1739121300000 implements MigrationInterface {
  name = 'UserPushDevices1739121300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_push_devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "deviceId" character varying(120),
        "pushToken" text NOT NULL,
        "provider" character varying(16) NOT NULL DEFAULT 'expo',
        "platform" character varying(16),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_push_devices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_push_devices_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_user_push_devices_user_token"
      ON "user_push_devices" ("userId", "pushToken")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_push_devices_user_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_push_devices"`);
  }
}
