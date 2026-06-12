import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase15ApiWebhooks1806000000000 implements MigrationInterface {
  name = 'Phase15ApiWebhooks1806000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "api_key" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "name" varchar NOT NULL, "keyHash" varchar NOT NULL UNIQUE, "keyPrefix" varchar NOT NULL, "scope" varchar DEFAULT 'read_only', "rateLimitRpm" integer, "rateLimitBurst" integer, "expiresAt" timestamptz, "lastUsedAt" timestamptz, "requestCount" integer DEFAULT 0, "enabled" boolean DEFAULT true, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(), CONSTRAINT "FK_api_key_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "webhook_subscription" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "name" varchar NOT NULL, "url" varchar NOT NULL, "events" text NOT NULL, "secret" varchar, "enabled" boolean DEFAULT true, "successCount" integer DEFAULT 0, "failureCount" integer DEFAULT 0, "lastDeliveryAt" timestamptz, "lastError" text, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(), CONSTRAINT "FK_webhook_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "webhook_delivery" ("id" SERIAL PRIMARY KEY, "subscriptionId" integer NOT NULL, "event" varchar NOT NULL, "success" boolean NOT NULL, "responseStatus" integer DEFAULT 0, "attempt" integer DEFAULT 1, "error" text, "createdAt" timestamptz DEFAULT now(), CONSTRAINT "FK_delivery_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscription"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_subscription_userId" ON "webhook_subscription" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_delivery_subscriptionId" ON "webhook_delivery" ("subscriptionId")`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_delivery" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_subscription" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_key" CASCADE`);
  }
}
