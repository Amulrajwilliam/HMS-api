import { MigrationInterface, QueryRunner } from 'typeorm';

export class InvoiceBillableServiceLink1740000000005 implements MigrationInterface {
  name = 'InvoiceBillableServiceLink1740000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_items"
      ADD COLUMN IF NOT EXISTS "billableServiceId" uuid NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_invoice_items_billable_service'
        ) THEN
          ALTER TABLE "invoice_items"
          ADD CONSTRAINT "FK_invoice_items_billable_service"
          FOREIGN KEY ("billableServiceId") REFERENCES "billable_services"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "FK_invoice_items_billable_service"
    `);
    await queryRunner.query(`
      ALTER TABLE "invoice_items" DROP COLUMN IF EXISTS "billableServiceId"
    `);
  }
}
