import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserProfileExtras1739121400000 implements MigrationInterface {
  name = 'UserProfileExtras1739121400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatarUrl" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferredLocale" character varying(16)`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferredTheme" character varying(16)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "preferredTheme"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "preferredLocale"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatarUrl"`);
  }
}
