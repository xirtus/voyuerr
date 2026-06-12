import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase15ApiWebhooks1806000000000 implements MigrationInterface {
  name = 'Phase15ApiWebhooks1806000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "api_key" ("id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "name" varchar NOT NULL, "keyHash" varchar NOT NULL UNIQUE, "keyPrefix" varchar NOT NULL, "scope" varchar DEFAULT 'read_only', "rateLimitRpm" integer, "rateLimitBurst" integer, "expiresAt" datetime, "lastUsedAt" datetime, "requestCount" integer DEFAULT 0, "enabled" boolean DEFAULT 1, "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')), FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "webhook_subscription" ("id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "name" varchar NOT NULL, "url" varchar NOT NULL, "events" text NOT NULL, "secret" varchar, "enabled" boolean DEFAULT 1, "successCount" integer DEFAULT 0, "failureCount" integer DEFAULT 0, "lastDeliveryAt" datetime, "lastError" text, "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')), FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE TABLE "webhook_delivery" ("id" integer PRIMARY KEY AUTOINCREMENT, "subscriptionId" integer NOT NULL, "event" varchar NOT NULL, "success" boolean NOT NULL, "responseStatus" integer DEFAULT 0, "attempt" integer DEFAULT 1, "error" text, "createdAt" datetime DEFAULT (datetime('now')), FOREIGN KEY ("subscriptionId") REFERENCES "webhook_subscription"("id") ON DELETE CASCADE)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_delivery"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_subscription"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_key"`);
  }
}
