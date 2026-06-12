import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SQLite: Add FTS5 virtual table for full-text search on scenes.
 * FTS5 provides fast, relevance-ranked full-text queries.
 */
export class AddSearchIndexes1805000000003 implements MigrationInterface {
  name = 'AddSearchIndexes1805000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create FTS5 virtual table
    await queryRunner.query(`
      CREATE VIRTUAL TABLE IF NOT EXISTS "scene_fts" USING fts5(
        "title",
        "originalTitle",
        "description",
        "tags",
        content="scene",
        content_rowid="id"
      )
    `);

    // Triggers to keep FTS index in sync
    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS "scene_fts_insert" AFTER INSERT ON "scene" BEGIN
        INSERT INTO "scene_fts" (rowid, "title", "originalTitle", "description", "tags")
        VALUES (new."id", new."title", new."originalTitle", new."description", new."tags");
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS "scene_fts_delete" AFTER DELETE ON "scene" BEGIN
        INSERT INTO "scene_fts" ("scene_fts", rowid, "title", "originalTitle", "description", "tags")
        VALUES ('delete', old."id", old."title", old."originalTitle", old."description", old."tags");
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER IF NOT EXISTS "scene_fts_update" AFTER UPDATE ON "scene" BEGIN
        INSERT INTO "scene_fts" ("scene_fts", rowid, "title", "originalTitle", "description", "tags")
        VALUES ('delete', old."id", old."title", old."originalTitle", old."description", old."tags");
        INSERT INTO "scene_fts" (rowid, "title", "originalTitle", "description", "tags")
        VALUES (new."id", new."title", new."originalTitle", new."description", new."tags");
      END
    `);

    // Populate existing data
    await queryRunner.query(`
      INSERT INTO "scene_fts" (rowid, "title", "originalTitle", "description", "tags")
      SELECT "id", "title", "originalTitle", "description", "tags" FROM "scene"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "scene_fts_update"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "scene_fts_delete"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "scene_fts_insert"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "scene_fts"`);
  }
}
