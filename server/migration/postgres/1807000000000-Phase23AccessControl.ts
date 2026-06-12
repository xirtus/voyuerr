import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase23AccessControl1807000000000 implements MigrationInterface {
  name = 'Phase23AccessControl1807000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "library_access" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "libraryId" varchar NOT NULL, "accessLevel" varchar DEFAULT 'read', "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now(), CONSTRAINT "FK_library_access_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE, CONSTRAINT "UQ_library_access" UNIQUE ("userId", "libraryId"))`);
    await queryRunner.query(`CREATE TABLE "guest_token" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "token" varchar NOT NULL UNIQUE, "name" varchar NOT NULL, "expiresAt" timestamptz, "maxRequests" integer DEFAULT 10, "usedRequests" integer DEFAULT 0, "enabled" boolean DEFAULT true, "createdAt" timestamptz DEFAULT now(), CONSTRAINT "FK_guest_token_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE)`);
    await queryRunner.query(`CREATE INDEX "IDX_library_access_userId" ON "library_access" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_guest_token_userId" ON "guest_token" ("userId")`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "guest_token" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "library_access" CASCADE`);
  }
}
