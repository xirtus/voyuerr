import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6PrivacySettings1799000000002 implements MigrationInterface {
  name = 'Phase6PrivacySettings1799000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // SQLite: add columns with default values
    await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN "categoryAllowList" TEXT DEFAULT NULL`);
    await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN "categoryBlockList" TEXT DEFAULT NULL`);
    try { await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN "nsfwBlur" BOOLEAN DEFAULT 1`); } catch {}
    try { await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN "privacyMode" BOOLEAN DEFAULT 0`); } catch {}
    try { await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN "notificationPrivacy" BOOLEAN DEFAULT 0`); } catch {}
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite doesn't support DROP COLUMN easily — handled via table recreation if needed
  }
}
