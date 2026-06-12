/**
 * Backup & Restore Manager — Phase 14
 * Automated database backup, WAL archiving reference, restore procedures.
 */
import logger from '@server/logger';
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.env.CONFIG_DIRECTORY || './config', 'backups');
const MAX_BACKUPS = 14; // Keep 2 weeks of daily backups

export class BackupManager {
  /** Create a timestamped SQLite backup. */
  static async createBackup(): Promise<string> {
    const dbPath = process.env.CONFIG_DIRECTORY
      ? path.join(process.env.CONFIG_DIRECTORY, 'db', 'db.sqlite3')
      : path.join('config', 'db', 'db.sqlite3');

    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `voyeurr-backup-${timestamp}.sqlite3`);

    try {
      await fs.copyFile(dbPath, backupPath);
      logger.info(`Backup created: ${backupPath}`, { label: 'Backup' });

      // Compress
      execSync(`gzip -f "${backupPath}"`);
      logger.info(`Backup compressed: ${backupPath}.gz`, { label: 'Backup' });

      // Rotate old backups
      await BackupManager.rotateBackups();

      return `${backupPath}.gz`;
    } catch (e) {
      logger.error('Backup failed', { label: 'Backup', errorMessage: e.message });
      throw e;
    }
  }

  /** Rotate old backups, keeping only the most recent N. */
  static async rotateBackups(): Promise<void> {
    try {
      const files = await fs.readdir(BACKUP_DIR);
      const backups = files
        .filter(f => f.startsWith('voyeurr-backup-') && f.endsWith('.gz'))
        .sort()
        .reverse();

      for (const file of backups.slice(MAX_BACKUPS)) {
        await fs.unlink(path.join(BACKUP_DIR, file));
        logger.debug(`Rotated old backup: ${file}`, { label: 'Backup' });
      }
    } catch { /* directory may not exist */ }
  }

  /** List available backups. */
  static async listBackups(): Promise<{ name: string; size: number; date: string }[]> {
    try {
      const files = await fs.readdir(BACKUP_DIR);
      const backups = [];
      for (const f of files.filter(f => f.startsWith('voyeurr-backup-') && f.endsWith('.gz'))) {
        const stat = await fs.stat(path.join(BACKUP_DIR, f));
        const dateStr = f.replace('voyeurr-backup-', '').replace('.sqlite3.gz', '');
        backups.push({ name: f, size: stat.size, date: dateStr });
      }
      return backups.sort((a, b) => b.date.localeCompare(a.date));
    } catch {
      return [];
    }
  }

  /** Restore from a backup file. */
  static async restoreBackup(backupName: string): Promise<void> {
    const backupPath = path.join(BACKUP_DIR, backupName);
    const dbPath = process.env.CONFIG_DIRECTORY
      ? path.join(process.env.CONFIG_DIRECTORY, 'db', 'db.sqlite3')
      : path.join('config', 'db', 'db.sqlite3');

    try {
      await fs.access(backupPath);
    } catch {
      throw new Error(`Backup not found: ${backupName}`);
    }

    // Decompress
    execSync(`gunzip -c "${backupPath}" > "${dbPath}.restore"`);
    // Replace current DB
    await fs.rename(`${dbPath}.restore`, dbPath);
    logger.info(`Restored backup: ${backupName}`, { label: 'Backup' });
  }

  /** Schedule automated daily backups (call from job scheduler). */
  static async scheduledBackup(): Promise<void> {
    try {
      await BackupManager.createBackup();
    } catch (e) {
      logger.error('Scheduled backup failed', { label: 'Backup', errorMessage: e.message });
    }
  }
}

export default BackupManager;
