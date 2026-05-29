import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3InsuranceAndIntegrations1739120600000 implements MigrationInterface {
  name = 'Phase3InsuranceAndIntegrations1739120600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "insurance_claims" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "claimNumber" character varying NOT NULL,
        "providerName" character varying NOT NULL,
        "policyNumber" character varying,
        "claimAmount" numeric(10,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'draft',
        "externalClaimId" character varying,
        "notes" text,
        "invoiceId" uuid,
        "submittedById" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_insurance_claim_number" UNIQUE ("claimNumber"),
        CONSTRAINT "PK_insurance_claims" PRIMARY KEY ("id"),
        CONSTRAINT "FK_insurance_claim_invoice" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
        CONSTRAINT "FK_insurance_claim_user" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_insurance_claims_status" ON "insurance_claims" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_insurance_claims_createdAt" ON "insurance_claims" ("createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "insurance_claims"`);
  }
}
