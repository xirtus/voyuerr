import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rename Collection → Series tables.
 *
 * - collection       → series
 * - collection_scene → series_scene
 * - Update FK column names accordingly.
 *
 * This migration is reversible.
 */
export class RenameCollectionTables1805000000001 implements MigrationInterface {
  name = 'RenameCollectionTables1805000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename tables
    await queryRunner.query(`ALTER TABLE "collection_scene" RENAME TO "series_scene"`);
    await queryRunner.query(`ALTER TABLE "collection" RENAME TO "series"`);

    // Rename columns in series_scene
    await queryRunner.query(`ALTER TABLE "series_scene" RENAME COLUMN "collectionId" TO "seriesId"`);

    // Rename FKs in series_scene
    await queryRunner.query(`ALTER TABLE "series_scene" DROP CONSTRAINT "FK_collection_scene_collection"`);
    await queryRunner.query(`ALTER TABLE "series_scene" DROP CONSTRAINT "FK_collection_scene_scene"`);
    await queryRunner.query(`ALTER TABLE "series_scene" ADD CONSTRAINT "FK_series_scene_series" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "series_scene" ADD CONSTRAINT "FK_series_scene_scene" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE`);

    // Rename indexes
    await queryRunner.query(`ALTER INDEX "IDX_collection_scene_collectionId" RENAME TO "IDX_series_scene_seriesId"`);
    await queryRunner.query(`ALTER INDEX "IDX_collection_scene_sceneId" RENAME TO "IDX_series_scene_sceneId"`);
    await queryRunner.query(`ALTER INDEX "UQ_collection_scene_unique" RENAME TO "UQ_series_scene_unique"`);
    await queryRunner.query(`ALTER INDEX "IDX_collection_title" RENAME TO "IDX_series_title"`);
    await queryRunner.query(`ALTER INDEX "IDX_collection_externalId" RENAME TO "IDX_series_externalId"`);

    // Rename FK column in media
    await queryRunner.query(`ALTER TABLE "media" RENAME COLUMN "collectionId" TO "seriesId"`);
    await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "FK_media_collection"`);
    await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "FK_media_series" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER INDEX "IDX_media_collectionId" RENAME TO "IDX_media_seriesId"`);

    // Rename FK column in watchlist
    await queryRunner.query(`ALTER TABLE "watchlist" RENAME COLUMN "collectionId" TO "seriesId"`);
    await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_watchlist_collectionId" RENAME TO "IDX_watchlist_seriesId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert watchlist
    await queryRunner.query(`ALTER TABLE "watchlist" RENAME COLUMN "seriesId" TO "collectionId"`);
    await queryRunner.query(`ALTER INDEX IF EXISTS "IDX_watchlist_seriesId" RENAME TO "IDX_watchlist_collectionId"`);

    // Revert media
    await queryRunner.query(`ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "FK_media_series"`);
    await queryRunner.query(`ALTER TABLE "media" RENAME COLUMN "seriesId" TO "collectionId"`);
    await queryRunner.query(`ALTER TABLE "media" ADD CONSTRAINT "FK_media_collection" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE SET NULL`);
    await queryRunner.query(`ALTER INDEX "IDX_media_seriesId" RENAME TO "IDX_media_collectionId"`);

    // Revert indexes
    await queryRunner.query(`ALTER INDEX "IDX_series_externalId" RENAME TO "IDX_collection_externalId"`);
    await queryRunner.query(`ALTER INDEX "IDX_series_title" RENAME TO "IDX_collection_title"`);
    await queryRunner.query(`ALTER INDEX "UQ_series_scene_unique" RENAME TO "UQ_collection_scene_unique"`);
    await queryRunner.query(`ALTER INDEX "IDX_series_scene_sceneId" RENAME TO "IDX_collection_scene_sceneId"`);
    await queryRunner.query(`ALTER INDEX "IDX_series_scene_seriesId" RENAME TO "IDX_collection_scene_collectionId"`);

    // Revert series_scene FKs
    await queryRunner.query(`ALTER TABLE "series_scene" DROP CONSTRAINT "FK_series_scene_scene"`);
    await queryRunner.query(`ALTER TABLE "series_scene" DROP CONSTRAINT "FK_series_scene_series"`);
    await queryRunner.query(`ALTER TABLE "series_scene" RENAME COLUMN "seriesId" TO "collectionId"`);

    // Revert table names
    await queryRunner.query(`ALTER TABLE "series" RENAME TO "collection"`);
    await queryRunner.query(`ALTER TABLE "series_scene" RENAME TO "collection_scene"`);

    // Re-add old FKs
    await queryRunner.query(`ALTER TABLE "collection_scene" ADD CONSTRAINT "FK_collection_scene_collection" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "collection_scene" ADD CONSTRAINT "FK_collection_scene_scene" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE`);
  }
}
