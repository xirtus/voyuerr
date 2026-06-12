import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase23AccessControl1807000000000 implements MigrationInterface {
  name = 'Phase23AccessControl1807000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "library_access" ("id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "libraryId" varchar NOT NULL, "accessLevel" varchar DEFAULT 'read', "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')), FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE, UNIQUE ("userId", "libraryId"))`);
    await queryRunner.query(`CREATE TABLE "guest_token" ("id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "token" varchar NOT NULL UNIQUE, "name" varchar NOT NULL, "expiresAt" datetime, "maxRequests" integer DEFAULT 10, "usedRequests" integer DEFAULT 0, "enabled" boolean DEFAULT 1, "createdAt" datetime DEFAULT (datetime('now')), FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE)`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "guest_token"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_access"`);
  }
}
