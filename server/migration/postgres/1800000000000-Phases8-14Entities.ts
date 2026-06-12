import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Phases8Thru14Entities1800000000000 implements MigrationInterface {
  name = 'Phases8Thru14Entities1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "saved_search" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "name" varchar NOT NULL, "query" text NOT NULL, "isDefault" boolean DEFAULT false, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_saved_search_user" FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE TABLE "rating" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "sceneId" integer NOT NULL, "score" integer NOT NULL, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_rating_user" FOREIGN KEY ("userId") REFERENCES "user"("id"), CONSTRAINT "UQ_rating_user_scene" UNIQUE ("userId", "sceneId"))`);
    await queryRunner.query(`CREATE TABLE "review" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "sceneId" integer NOT NULL, "body" text NOT NULL, "hasSpoilers" boolean DEFAULT false, "upvotes" integer DEFAULT 0, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_review_user" FOREIGN KEY ("userId") REFERENCES "user"("id"), CONSTRAINT "UQ_review_user_scene" UNIQUE ("userId", "sceneId"))`);
    await queryRunner.query(`CREATE TABLE "favorite" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "entityType" varchar NOT NULL, "entityId" integer NOT NULL, "createdAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_favorite_user" FOREIGN KEY ("userId") REFERENCES "user"("id"), CONSTRAINT "UQ_favorite_entity" UNIQUE ("userId", "entityType", "entityId"))`);
    await queryRunner.query(`CREATE TABLE "watch_history" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "sceneId" integer NOT NULL, "watched" boolean DEFAULT false, "resumePosition" integer, "playCount" integer DEFAULT 1, "lastWatchedAt" TIMESTAMP, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_watch_history_user" FOREIGN KEY ("userId") REFERENCES "user"("id"), CONSTRAINT "UQ_watch_history" UNIQUE ("userId", "sceneId"))`);
    await queryRunner.query(`CREATE TABLE "user_collection" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "name" varchar NOT NULL, "description" text, "isPublic" boolean DEFAULT false, "sceneIds" text, "followerCount" integer DEFAULT 0, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_collection_user" FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE TABLE "auto_approve_rule" ("id" SERIAL PRIMARY KEY, "enabled" boolean DEFAULT true, "name" varchar NOT NULL, "categories" text, "performerIds" text, "studioIds" text, "qualityIds" text, "minRequestCount" integer DEFAULT 0, "priority" integer DEFAULT 0, "autoUpgrade4k" boolean DEFAULT false, "autoUpgradeVR" boolean DEFAULT false, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now())`);
    await queryRunner.query(`CREATE TABLE "request_retry" ("id" SERIAL PRIMARY KEY, "requestId" integer NOT NULL, "attemptCount" integer DEFAULT 0, "maxAttempts" integer DEFAULT 0, "nextRetryAt" TIMESTAMP, "lastError" text, "resolved" boolean DEFAULT false, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_retry_request" FOREIGN KEY ("requestId") REFERENCES "media_request"("id"))`);
    await queryRunner.query(`CREATE TABLE "activity_feed" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "type" varchar NOT NULL, "data" text NOT NULL, "visibility" varchar DEFAULT 'public', "createdAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_activity_user" FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE TABLE "user_follow" ("id" SERIAL PRIMARY KEY, "followerId" integer NOT NULL, "followingId" integer NOT NULL, "createdAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_follow_follower" FOREIGN KEY ("followerId") REFERENCES "user"("id"), CONSTRAINT "FK_follow_following" FOREIGN KEY ("followingId") REFERENCES "user"("id"), CONSTRAINT "UQ_follow" UNIQUE ("followerId", "followingId"))`);
    await queryRunner.query(`CREATE TABLE "comment" ("id" SERIAL PRIMARY KEY, "userId" integer NOT NULL, "sceneId" integer NOT NULL, "parentId" integer, "body" text NOT NULL, "upvotes" integer DEFAULT 0, "downvotes" integer DEFAULT 0, "createdAt" TIMESTAMP DEFAULT now(), "updatedAt" TIMESTAMP DEFAULT now(), CONSTRAINT "FK_comment_user" FOREIGN KEY ("userId") REFERENCES "user"("id"))`);
    await queryRunner.query(`CREATE TABLE "analytics_event" ("id" SERIAL PRIMARY KEY, "eventType" varchar NOT NULL, "payload" text NOT NULL, "userId" varchar DEFAULT 'anon', "createdAt" TIMESTAMP DEFAULT now())`);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_rating_scene" ON "rating" ("sceneId")`);
    await queryRunner.query(`CREATE INDEX "IDX_review_scene" ON "review" ("sceneId")`);
    await queryRunner.query(`CREATE INDEX "IDX_watch_history_scene" ON "watch_history" ("sceneId")`);
    await queryRunner.query(`CREATE INDEX "IDX_request_retry_request" ON "request_retry" ("requestId")`);
    await queryRunner.query(`CREATE INDEX "IDX_activity_feed_created" ON "activity_feed" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_comment_scene" ON "comment" ("sceneId")`);
    await queryRunner.query(`CREATE INDEX "IDX_analytics_event_type" ON "analytics_event" ("eventType")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_event" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "comment" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_follow" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "activity_feed" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "request_retry" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "auto_approve_rule" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_collection" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "watch_history" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "favorite" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "review" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rating" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_search" CASCADE`);
  }
}
