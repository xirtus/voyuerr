import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add normalized scene_categories join table to replace comma-separated
 * categories column on the scene entity.
 *
 * Also populates existing data by splitting the categories column.
 */
export class AddSceneCategories1805000000002 implements MigrationInterface {
  name = 'AddSceneCategories1805000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "scene_category" (
        "id" SERIAL PRIMARY KEY,
        "sceneId" integer NOT NULL,
        "category" varchar NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_scene_category_scene" FOREIGN KEY ("sceneId") REFERENCES "scene"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_scene_category" UNIQUE ("sceneId", "category")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_scene_category_sceneId" ON "scene_category" ("sceneId")`);
    await queryRunner.query(`CREATE INDEX "IDX_scene_category_category" ON "scene_category" ("category")`);

    // Populate existing categories from comma-separated column
    await queryRunner.query(`
      INSERT INTO "scene_category" ("sceneId", "category")
      SELECT s."id" AS "sceneId", trim(cat.value) AS category
      FROM "scene" s,
           LATERAL unnest(string_to_array(s."categories", ',')) AS cat(value)
      WHERE s."categories" IS NOT NULL
        AND s."categories" != ''
        AND trim(cat.value) != ''
      ON CONFLICT ("sceneId", "category") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "scene_category" CASCADE`);
  }
}
