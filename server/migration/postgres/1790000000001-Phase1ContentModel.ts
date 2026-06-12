import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1 — Content Model Migration (PostgreSQL)
 *
 * Creates the new adult content entity tables and alters existing tables
 * to support the Voyeurr content taxonomy.
 */
export class Phase1ContentModel1790000000001 implements MigrationInterface {
  name = 'Phase1ContentModel1790000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Performer ──────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "performer" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "aliases" text,
        "birthDate" varchar,
        "bio" text,
        "gender" varchar NOT NULL DEFAULT 'female',
        "imageUrl" varchar,
        "thumbnailUrl" varchar,
        "externalIds" text,
        "country" varchar,
        "height" integer,
        "weight" integer,
        "measurements" varchar,
        "sceneCount" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "adult" boolean NOT NULL DEFAULT true,
        "popularity" float NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_performer_name" ON "performer" ("name")`
    );

    // ── Studio ─────────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "studio" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        "description" text,
        "logoUrl" varchar,
        "backdropUrl" varchar,
        "websiteUrl" varchar,
        "parentStudioId" integer,
        "networkType" varchar NOT NULL DEFAULT 'independent',
        "country" varchar,
        "foundedYear" integer,
        "externalIds" text,
        "sceneCount" integer NOT NULL DEFAULT 0,
        "popularity" float NOT NULL DEFAULT 0,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
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
        "id" SERIAL PRIMARY KEY,
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
        "status" integer NOT NULL DEFAULT 1,
        "status4k" integer NOT NULL DEFAULT 1,
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
        "mediaAddedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
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

    // ── ScenePerformer ─────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "scene_performer" (
        "id" SERIAL PRIMARY KEY,
        "sceneId" integer NOT NULL,
        "performerId" integer NOT NULL,
        "role" varchar NOT NULL DEFAULT 'starring',
        "sortOrder" integer NOT NULL DEFAULT 0,
        "characterName" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_scene_performer_scene" FOREIGN KEY ("sceneId") REFERENCES "scene" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_scene_performer_performer" FOREIGN KEY ("performerId") REFERENCES "performer" ("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_scene_performer_unique" UNIQUE ("sceneId", "performerId")
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scene_performer_sceneId" ON "scene_performer" ("sceneId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scene_performer_performerId" ON "scene_performer" ("performerId")`
    );

    // ── Collection ─────────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "collection" (
        "id" SERIAL PRIMARY KEY,
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
        "totalScenes" integer NOT NULL DEFAULT 0,
        "status" integer NOT NULL DEFAULT 1,
        "status4k" integer NOT NULL DEFAULT 1,
        "isOngoing" boolean NOT NULL DEFAULT false,
        "popularity" float NOT NULL DEFAULT 0,
        "serviceId" integer,
        "serviceId4k" integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collection_title" ON "collection" ("title")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collection_externalId" ON "collection" ("externalId")`
    );

    // ── CollectionScene ────────────────────────────────────────────
    await queryRunner.query(
      `CREATE TABLE "collection_scene" (
        "id" SERIAL PRIMARY KEY,
        "collectionId" integer NOT NULL,
        "sceneId" integer NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "label" varchar,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_collection_scene_collection" FOREIGN KEY ("collectionId") REFERENCES "collection" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_collection_scene_scene" FOREIGN KEY ("sceneId") REFERENCES "scene" ("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_collection_scene_unique" UNIQUE ("collectionId", "sceneId")
      )`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collection_scene_collectionId" ON "collection_scene" ("collectionId")`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collection_scene_sceneId" ON "collection_scene" ("sceneId")`
    );

    // ── Alter: media ───────────────────────────────────────────────
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "contentType" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "contentCategory" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "externalId" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "externalSource" varchar`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "sceneId" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD COLUMN "collectionId" integer`
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
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "FK_media_scene" FOREIGN KEY ("sceneId") REFERENCES "scene" ("id") ON DELETE SET NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "media" ADD CONSTRAINT "FK_media_collection" FOREIGN KEY ("collectionId") REFERENCES "collection" ("id") ON DELETE SET NULL`
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
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "FK_media_collection"`
    );
    await queryRunner.query(
      `ALTER TABLE "media" DROP CONSTRAINT "FK_media_scene"`
    );
    await queryRunner.query(`DROP INDEX "IDX_media_collectionId"`);
    await queryRunner.query(`DROP INDEX "IDX_media_sceneId"`);
    await queryRunner.query(`DROP INDEX "IDX_media_externalId_contentType"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "collectionId"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "sceneId"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "externalSource"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "externalId"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "contentCategory"`);
    await queryRunner.query(`ALTER TABLE "media" DROP COLUMN "contentType"`);

    // ── Drop: collection_scene ─────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_collection_scene_sceneId"`);
    await queryRunner.query(`DROP INDEX "IDX_collection_scene_collectionId"`);
    await queryRunner.query(`DROP TABLE "collection_scene"`);

    // ── Drop: collection ───────────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_collection_externalId"`);
    await queryRunner.query(`DROP INDEX "IDX_collection_title"`);
    await queryRunner.query(`DROP TABLE "collection"`);

    // ── Drop: scene_performer ──────────────────────────────────────
    await queryRunner.query(`DROP INDEX "IDX_scene_performer_performerId"`);
    await queryRunner.query(`DROP INDEX "IDX_scene_performer_sceneId"`);
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
