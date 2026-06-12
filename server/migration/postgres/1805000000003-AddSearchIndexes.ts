import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add PostgreSQL full-text search indexes for the adult content model.
 *
 * Creates:
 *   - tsvector GIN index on scene (title, originalTitle, description, tags)
 *   - Trigram (pg_trgm) indexes for fuzzy LIKE matching
 *   - Index on performer name for autocomplete
 */
export class AddSearchIndexes1805000000003 implements MigrationInterface {
  name = 'AddSearchIndexes1805000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable required extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);

    // tsvector column for full-text search
    await queryRunner.query(`
      ALTER TABLE "scene"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    `);

    // GIN index on the tsvector
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_scene_search_vector"
      ON "scene" USING GIN ("search_vector")
    `);

    // Trigger to keep search_vector updated automatically
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION scene_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."search_vector" :=
          setweight(to_tsvector('english', unaccent(coalesce(NEW."title", ''))), 'A') ||
          setweight(to_tsvector('english', unaccent(coalesce(NEW."originalTitle", ''))), 'B') ||
          setweight(to_tsvector('english', unaccent(coalesce(NEW."description", ''))), 'C') ||
          setweight(to_tsvector('english', unaccent(coalesce(NEW."tags", ''))), 'D');
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_scene_search_vector ON "scene"
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_scene_search_vector
      BEFORE INSERT OR UPDATE ON "scene"
      FOR EACH ROW EXECUTE FUNCTION scene_search_vector_update()
    `);

    // Update existing rows
    await queryRunner.query(`
      UPDATE "scene" SET "search_vector" =
        setweight(to_tsvector('english', unaccent(coalesce("title", ''))), 'A') ||
        setweight(to_tsvector('english', unaccent(coalesce("originalTitle", ''))), 'B') ||
        setweight(to_tsvector('english', unaccent(coalesce("description", ''))), 'C') ||
        setweight(to_tsvector('english', unaccent(coalesce("tags", ''))), 'D')
    `);

    // Trigram indexes for fuzzy matching (autocomplete)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_scene_title_trgm" ON "scene" USING GIN ("title" gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_performer_name_trgm" ON "performer" USING GIN ("name" gin_trgm_ops)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_studio_name_trgm" ON "studio" USING GIN ("name" gin_trgm_ops)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_scene_search_vector ON "scene"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS scene_search_vector_update()`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scene_search_vector"`);
    await queryRunner.query(`ALTER TABLE "scene" DROP COLUMN IF EXISTS "search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_scene_title_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_performer_name_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_studio_name_trgm"`);
  }
}
