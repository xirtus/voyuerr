import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6PrivacySettings1799000000002 implements MigrationInterface {
  name = 'Phase6PrivacySettings1799000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Category allow/block lists (JSON text fields)
    await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "categoryAllowList" TEXT`);
    await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "categoryBlockList" TEXT`);

    // NSFW blur preference
    await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "nsfwBlur" BOOLEAN DEFAULT true`);

    // Privacy mode (anonymous requests)
    await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "privacyMode" BOOLEAN DEFAULT false`);

    // Notification privacy
    await queryRunner.query(`ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "notificationPrivacy" BOOLEAN DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "categoryAllowList"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "categoryBlockList"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "nsfwBlur"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "privacyMode"`);
    await queryRunner.query(`ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "notificationPrivacy"`);
  }
}
