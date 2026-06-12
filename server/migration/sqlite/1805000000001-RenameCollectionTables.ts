import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SQLite version of the Collection → Series table rename.
 * SQLite has limited ALTER TABLE support, so we use a rebuild approach.
 */
export class RenameCollectionTables1805000000001 implements MigrationInterface {
  name = 'RenameCollectionTables1805000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SQLite: rename tables
    await queryRunner.query(`ALTER TABLE "collection_scene" RENAME TO "series_scene"`);
    await queryRunner.query(`ALTER TABLE "collection" RENAME TO "series"`);

    // Recreate junction table with new column names
    await queryRunner.query(`
      CREATE TABLE "series_scene_new" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "seriesId" integer NOT NULL,
        "sceneId" integer NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "label" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE,
        FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE,
        UNIQUE ("seriesId", "sceneId")
      )
    `);
    await queryRunner.query(`INSERT INTO "series_scene_new" ("id", "seriesId", "sceneId", "order", "label", "createdAt") SELECT "id", "collectionId", "sceneId", "order", "label", "createdAt" FROM "series_scene"`);
    await queryRunner.query(`DROP TABLE "series_scene"`);
    await queryRunner.query(`ALTER TABLE "series_scene_new" RENAME TO "series_scene"`);
    await queryRunner.query(`CREATE INDEX "IDX_series_scene_seriesId" ON "series_scene" ("seriesId")`);
    await queryRunner.query(`CREATE INDEX "IDX_series_scene_sceneId" ON "series_scene" ("sceneId")`);

    // Rename column in media
    await queryRunner.query(`ALTER TABLE "media" RENAME COLUMN "collectionId" TO "seriesId"`);

    // Rename column in watchlist
    await queryRunner.query(`ALTER TABLE "watchlist" RENAME COLUMN "collectionId" TO "seriesId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "watchlist" RENAME COLUMN "seriesId" TO "collectionId"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME COLUMN "seriesId" TO "collectionId"`);

    // Rebuild junction table
    await queryRunner.query(`
      CREATE TABLE "series_scene_old" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "collectionId" integer NOT NULL,
        "sceneId" integer NOT NULL,
        "order" integer NOT NULL DEFAULT 0,
        "label" varchar,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY ("collectionId") REFERENCES "series"("id") ON DELETE CASCADE,
        FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE,
        UNIQUE ("collectionId", "sceneId")
      )
    `);
    await queryRunner.query(`INSERT INTO "series_scene_old" ("id", "collectionId", "sceneId", "order", "label", "createdAt") SELECT "id", "seriesId", "sceneId", "order", "label", "createdAt" FROM "series_scene"`);
    await queryRunner.query(`DROP TABLE "series_scene"`);
    await queryRunner.query(`ALTER TABLE "series_scene_old" RENAME TO "collection_scene"`);

    await queryRunner.query(`ALTER TABLE "series" RENAME TO "collection"`);
  }
}
