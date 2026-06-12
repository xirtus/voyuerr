import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SQLite: Add normalized scene_category join table.
 * SQLite doesn't have ON CONFLICT, so we use INSERT OR IGNORE.
 */
export class AddSceneCategories1805000000002 implements MigrationInterface {
  name = 'AddSceneCategories1805000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "scene_category" (
        "id" integer PRIMARY KEY AUTOINCREMENT,
        "sceneId" integer NOT NULL,
        "category" varchar NOT NULL,
        "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE,
        UNIQUE ("sceneId", "category")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_scene_category_sceneId" ON "scene_category" ("sceneId")`);
    await queryRunner.query(`CREATE INDEX "IDX_scene_category_category" ON "scene_category" ("category")`);

    // Populate from existing comma-separated data (manual approach for SQLite)
    const scenes = await queryRunner.query(`SELECT id, categories FROM "scene" WHERE categories IS NOT NULL AND categories != ''`);
    for (const row of scenes) {
      const cats = (row.categories as string).split(',').map((c: string) => c.trim()).filter(Boolean);
      for (const cat of cats) {
        await queryRunner.query(
          `INSERT OR IGNORE INTO "scene_category" ("sceneId", "category") VALUES (?, ?)`,
          [row.id, cat]
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "scene_category"`);
  }
}
