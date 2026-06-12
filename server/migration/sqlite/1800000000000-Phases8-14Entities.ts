import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Phases 8–14 combined entity migration. */
export class Phases8Thru14Entities1800000000000 implements MigrationInterface {
  name = 'Phases8Thru14Entities1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 9 — Search
    await queryRunner.query(`CREATE TABLE "saved_search" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "name" varchar NOT NULL,
      "query" text NOT NULL, "isDefault" boolean DEFAULT 0, "createdAt" datetime DEFAULT (datetime('now')),
      "updatedAt" datetime DEFAULT (datetime('now')), FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_saved_search_userId" ON "saved_search"("userId")`);

    // Phase 10 — Engagement
    await queryRunner.query(`CREATE TABLE "rating" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "sceneId" integer NOT NULL,
      "score" integer NOT NULL, "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "user"("id"), UNIQUE("userId","sceneId"))`);
    await queryRunner.query(`CREATE INDEX "IDX_rating_userId" ON "rating"("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_rating_sceneId" ON "rating"("sceneId")`);

    await queryRunner.query(`CREATE TABLE "review" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "sceneId" integer NOT NULL,
      "body" text NOT NULL, "hasSpoilers" boolean DEFAULT 0, "upvotes" integer DEFAULT 0,
      "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "user"("id"), UNIQUE("userId","sceneId"))`);
    await queryRunner.query(`CREATE INDEX "IDX_review_userId" ON "review"("userId")`);

    await queryRunner.query(`CREATE TABLE "favorite" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "entityType" varchar NOT NULL,
      "entityId" integer NOT NULL, "createdAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "user"("id"), UNIQUE("userId","entityType","entityId"))`);

    await queryRunner.query(`CREATE TABLE "watch_history" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "sceneId" integer NOT NULL,
      "watched" boolean DEFAULT 0, "resumePosition" integer, "playCount" integer DEFAULT 1,
      "lastWatchedAt" datetime, "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "user"("id"), UNIQUE("userId","sceneId"))`);
    await queryRunner.query(`CREATE INDEX "IDX_watch_history_userId" ON "watch_history"("userId")`);

    await queryRunner.query(`CREATE TABLE "user_collection" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "name" varchar NOT NULL,
      "description" text, "isPublic" boolean DEFAULT 0, "sceneIds" text, "followerCount" integer DEFAULT 0,
      "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_user_collection_userId" ON "user_collection"("userId")`);

    // Phase 11 — Automation
    await queryRunner.query(`CREATE TABLE "auto_approve_rule" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "enabled" boolean DEFAULT 1, "name" varchar NOT NULL,
      "categories" text, "performerIds" text, "studioIds" text, "qualityIds" text,
      "minRequestCount" integer DEFAULT 0, "priority" integer DEFAULT 0,
      "autoUpgrade4k" boolean DEFAULT 0, "autoUpgradeVR" boolean DEFAULT 0,
      "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')))`);

    await queryRunner.query(`CREATE TABLE "request_retry" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "requestId" integer NOT NULL, "attemptCount" integer DEFAULT 0,
      "maxAttempts" integer DEFAULT 0, "nextRetryAt" datetime, "lastError" text, "resolved" boolean DEFAULT 0,
      "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("requestId") REFERENCES "media_request"("id"))`);

    // Phase 12 — Social
    await queryRunner.query(`CREATE TABLE "activity_feed" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "type" varchar NOT NULL,
      "data" text NOT NULL, "visibility" varchar DEFAULT 'public', "createdAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_feed_userId" ON "activity_feed"("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_feed_createdAt" ON "activity_feed"("createdAt")`);

    await queryRunner.query(`CREATE TABLE "user_follow" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "followerId" integer NOT NULL, "followingId" integer NOT NULL,
      "createdAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("followerId") REFERENCES "user"("id"), FOREIGN KEY ("followingId") REFERENCES "user"("id"),
      UNIQUE("followerId","followingId"))`);
    await queryRunner.query(`CREATE INDEX "IDX_user_follow_followerId" ON "user_follow"("followerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_follow_followingId" ON "user_follow"("followingId")`);

    await queryRunner.query(`CREATE TABLE "comment" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "userId" integer NOT NULL, "sceneId" integer NOT NULL,
      "parentId" integer, "body" text NOT NULL, "upvotes" integer DEFAULT 0, "downvotes" integer DEFAULT 0,
      "createdAt" datetime DEFAULT (datetime('now')), "updatedAt" datetime DEFAULT (datetime('now')),
      FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE INDEX "IDX_comment_userId" ON "comment"("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_comment_sceneId" ON "comment"("sceneId")`);

    // Phase 13 — Analytics
    await queryRunner.query(`CREATE TABLE "analytics_event" (
      "id" integer PRIMARY KEY AUTOINCREMENT, "eventType" varchar NOT NULL, "payload" text NOT NULL,
      "userId" varchar DEFAULT 'anon', "createdAt" datetime DEFAULT (datetime('now')))`);
    await queryRunner.query(`CREATE INDEX "IDX_analytics_event_eventType" ON "analytics_event"("eventType")`);
    await queryRunner.query(`CREATE INDEX "IDX_analytics_event_createdAt" ON "analytics_event"("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_event"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comment"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_follow"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_feed"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "request_retry"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auto_approve_rule"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_collection"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "watch_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "favorite"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "review"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rating"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_search"`);
  }
}
