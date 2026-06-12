import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — Content Model Migration (SQLite)
 *
 * Creates the new adult content entity tables (performer, studio, scene,
 * scene_performer, collection, collection_scene) and alters existing tables
 * (media, watchlist, user) to support the new content taxonomy.
 */
export class Phase1ContentModel1790000000000 implements MigrationInterface {
  name = 'Phase1ContentModel1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Performer ──────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "performer" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" varchar NOT NULL,
        "aliases" text,
        "birthDate" varchar,
        "bio" text,
        "gender" varchar NOT NULL DEFAULT ('female'),
        "imageUrl" varchar,
        "thumbnailUrl" varchar,
        "externalIds" text,
        "country" varchar,
        "height" integer,
        "weight" integer,
        "measurements" varchar,
        "sceneCount" integer NOT NULL DEFAULT (0),
        "active" boolean NOT NULL DEFAULT (1),
        "adult" boolean NOT NULL DEFAULT (1),
        "popularity" float NOT NULL DEFAULT (0),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_performer_name" ON "performer" ("name")`
    );

    // ── Studio ─────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "studio" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "description" text,
        "logoUrl" varchar,
        "backdropUrl" varchar,
        "websiteUrl" varchar,
        "parentStudioId" integer,
        "networkType" varchar NOT NULL DEFAULT ('independent'),
        "country" varchar,
        "foundedYear" integer,
        "externalIds" text,
        "sceneCount" integer NOT NULL DEFAULT (0),
        "popularity" float NOT NULL DEFAULT (0),
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_studio_name" ON "studio" ("name")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_studio_slug" ON "studio" ("slug")`
    );

    // ── Scene ──────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "scene" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "contentType" varchar NOT NULL,
        "title" varchar NOT NULL,
        "originalTitle" varchar,
        "releaseDate" varchar,
        "releaseYear" integer,
        "runtime" integer,
        "description" text,
        "externalId" varchar NOT NULL,
        "externalSource" varchar NOT NULL,
        "externalIds" text,
        "categories" varchar,
        "tags" text,
        "posterUrl" varchar,
        "backdropUrl" varchar,
        "trailerUrl" varchar,
        "status" integer NOT NULL DEFAULT (1),
        "status4k" integer NOT NULL DEFAULT (1),
        "studioId" integer,
        "serviceId" integer,
        "serviceId4k" integer,
        "externalServiceId" integer,
        "externalServiceId4k" integer,
        "externalServiceSlug" varchar,
        "externalServiceSlug4k" varchar,
        "jellyfinMediaId" varchar,
        "jellyfinMediaId4k" varchar,
        "ratingKey" varchar,
        "ratingKey4k" varchar,
        "mediaAddedAt" datetime,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scene_title" ON "scene" ("title")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scene_externalId_contentType" ON "scene" ("externalId", "contentType")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scene_studioId" ON "scene" ("studioId")`
    );

    // ── ScenePerformer (junction) ──────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "scene_performer" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "sceneId" integer NOT NULL,
        "performerId" integer NOT NULL,
        "role" varchar NOT NULL DEFAULT ('starring'),
        "sortOrder" integer NOT NULL DEFAULT (0),
        "characterName" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_scene_performer_scene" FOREIGN KEY ("sceneId") REFERENCES "scene" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_scene_performer_performer" FOREIGN KEY ("performerId") REFERENCES "performer" ("id") ON DELETE CASCADE
      )`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_scene_performer_unique" ON "scene_performer" ("sceneId", "performerId")`
    );

    // ── Collection ─────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "collection" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "title" varchar NOT NULL,
        "originalTitle" varchar,
        "description" text,
        "externalId" varchar NOT NULL,
        "externalSource" varchar NOT NULL,
        "externalIds" text,
        "categories" varchar,
        "posterUrl" varchar,
        "backdropUrl" varchar,
        "firstReleaseDate" varchar,
        "lastReleaseDate" varchar,
        "studioId" integer,
        "totalScenes" integer NOT NULL DEFAULT (0),
        "status" integer NOT NULL DEFAULT (1),
        "status4k" integer NOT NULL DEFAULT (1),
        "isOngoing" boolean NOT NULL DEFAULT (0),
        "popularity" float NOT NULL DEFAULT (0),
        "serviceId" integer,
        "serviceId4k" integer,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collection_title" ON "collection" ("title")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collection_externalId" ON "collection" ("externalId")`
    );

    // ── CollectionScene (junction) ─────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "collection_scene" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "collectionId" integer NOT NULL,
        "sceneId" integer NOT NULL,
        "order" integer NOT NULL DEFAULT (0),
        "label" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_collection_scene_collection" FOREIGN KEY ("collectionId") REFERENCES "collection" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_collection_scene_scene" FOREIGN KEY ("sceneId") REFERENCES "scene" ("id") ON DELETE CASCADE
      )`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_collection_scene_unique" ON "collection_scene" ("collectionId", "sceneId")`
    );

    // ── Alter: media ───────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "temporary_media" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "mediaType" varchar NOT NULL,
        "contentType" varchar,
        "contentCategory" varchar,
        "tmdbId" integer NOT NULL,
        "tvdbId" integer,
        "imdbId" varchar,
        "externalId" varchar,
        "externalSource" varchar,
        "sceneId" integer,
        "collectionId" integer,
        "status" integer NOT NULL DEFAULT (1),
        "status4k" integer NOT NULL DEFAULT (1),
        "lastSeasonChange" datetime NOT NULL DEFAULT (datetime('now')),
        "mediaAddedAt" datetime,
        "serviceId" integer,
        "serviceId4k" integer,
        "externalServiceId" integer,
        "externalServiceId4k" integer,
        "externalServiceSlug" varchar,
        "externalServiceSlug4k" varchar,
        "ratingKey" varchar,
        "ratingKey4k" varchar,
        "jellyfinMediaId" varchar,
        "jellyfinMediaId4k" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_media_scene" FOREIGN KEY ("sceneId") REFERENCES "scene" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_media_collection" FOREIGN KEY ("collectionId") REFERENCES "collection" ("id") ON DELETE SET NULL
      )`
    );
    await queryRunner.query(
      `INSERT INTO "temporary_media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "createdAt", "updatedAt")
       SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "createdAt", "updatedAt" FROM "media"`
    );
    await queryRunner.query(`DROP TABLE "media"`);
    await queryRunner.query(`ALTER TABLE "temporary_media" RENAME TO "media"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_media_tmdbId_mediaType" ON "media" ("tmdbId", "mediaType")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_externalId_contentType" ON "media" ("externalId", "contentType")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_sceneId" ON "media" ("sceneId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_media_collectionId" ON "media" ("collectionId")`
    );

    // ── Alter: watchlist ───────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD COLUMN "sceneId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD COLUMN "collectionId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "watchlist" ADD COLUMN "contentType" varchar`
    );

    // ── Alter: user ────────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "sceneQuotaLimit" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "sceneQuotaDays" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "collectionQuotaLimit" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD COLUMN "collectionQuotaDays" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Revert: user ───────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "collectionQuotaDays"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "collectionQuotaLimit"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "sceneQuotaDays"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "sceneQuotaLimit"`);

    // ── Revert: watchlist ──────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE "watchlist" DROP COLUMN "contentType"`);
    await queryRunner.query(`ALTER TABLE "watchlist" DROP COLUMN "collectionId"`);
    await queryRunner.query(`ALTER TABLE "watchlist" DROP COLUMN "sceneId"`);

    // ── Revert: media ──────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_media_collectionId"`);
    await queryRunner.query(`DROP INDEX "IDX_media_sceneId"`);
    await queryRunner.query(`DROP INDEX "IDX_media_externalId_contentType"`);
    await queryRunner.query(`DROP INDEX "IDX_media_tmdbId_mediaType"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME TO "temporary_media"`);
    await queryRunner.query(
      `CREATE TABLE "media" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "mediaType" varchar NOT NULL,
        "tmdbId" integer NOT NULL,
        "tvdbId" integer,
        "imdbId" varchar,
        "status" integer NOT NULL DEFAULT (1),
        "status4k" integer NOT NULL DEFAULT (1),
        "lastSeasonChange" datetime NOT NULL DEFAULT (datetime('now')),
        "mediaAddedAt" datetime,
        "serviceId" integer,
        "serviceId4k" integer,
        "externalServiceId" integer,
        "externalServiceId4k" integer,
        "externalServiceSlug" varchar,
        "externalServiceSlug4k" varchar,
        "ratingKey" varchar,
        "ratingKey4k" varchar,
        "jellyfinMediaId" varchar,
        "jellyfinMediaId4k" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
      )`
    );
    await queryRunner.query(
      `INSERT INTO "media"("id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "createdAt", "updatedAt")
       SELECT "id", "mediaType", "tmdbId", "tvdbId", "imdbId", "status", "status4k", "lastSeasonChange", "mediaAddedAt", "serviceId", "serviceId4k", "externalServiceId", "externalServiceId4k", "externalServiceSlug", "externalServiceSlug4k", "ratingKey", "ratingKey4k", "jellyfinMediaId", "jellyfinMediaId4k", "createdAt", "updatedAt" FROM "temporary_media"`
    );
    await queryRunner.query(`DROP TABLE "temporary_media"`);

    // ── Drop: collection_scene ─────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_collection_scene_unique"`);
    await queryRunner.query(`DROP TABLE "collection_scene"`);

    // ── Drop: collection ───────────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_collection_externalId"`);
    await queryRunner.query(`DROP INDEX "IDX_collection_title"`);
    await queryRunner.query(`DROP TABLE "collection"`);

    // ── Drop: scene_performer ──────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_scene_performer_unique"`);
    await queryRunner.query(`DROP TABLE "scene_performer"`);

    // ── Drop: scene ────────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_scene_studioId"`);
    await queryRunner.query(`DROP INDEX "IDX_scene_externalId_contentType"`);
    await queryRunner.query(`DROP INDEX "IDX_scene_title"`);
    await queryRunner.query(`DROP TABLE "scene"`);

    // ── Drop: studio ───────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_studio_slug"`);
    await queryRunner.query(`DROP INDEX "IDX_studio_name"`);
    await queryRunner.query(`DROP TABLE "studio"`);

    // ── Drop: performer ────────────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_performer_name"`);
    await queryRunner.query(`DROP TABLE "performer"`);
  }
}
