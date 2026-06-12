import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import logger from '@server/logger';
import { Notification } from './index';
import type { NotificationPayload } from './agents/agent';

export enum DigestFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  NEVER = 'never',
}

interface DigestEntry {
  userId: number;
  type: Notification;
  payload: NotificationPayload;
  timestamp: Date;
}

/**
 * Notification Digest Engine — Phase 16
 *
 * Batches notifications into summary digests instead of immediate delivery.
 * Reduces notification fatigue by collapsing multiple request updates into
 * a single summary per digest period.
 */
class DigestEngine {
  private queue: DigestEntry[] = [];

  enqueue(userId: number, type: Notification, payload: NotificationPayload): void {
    this.queue.push({ userId, type, payload, timestamp: new Date() });
    logger.debug(`Digest enqueued for user ${userId}`, { label: 'Digest', queueSize: this.queue.length });
  }

  getUserEntries(userId: number): DigestEntry[] {
    return this.queue.filter(e => e.userId === userId);
  }

  flushUser(userId: number): DigestEntry[] {
    const entries = this.getUserEntries(userId);
    this.queue = this.queue.filter(e => e.userId !== userId);
    return entries;
  }

  buildDigestMessage(entries: DigestEntry[]): string {
    if (!entries.length) return '';
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      const label = Notification[entry.type] ?? 'Unknown';
      counts[label] = (counts[label] ?? 0) + 1;
    }
    const subjectList = entries.slice(0, 10).map(e => `• ${e.payload.subject}`).join('\n');
    const more = entries.length > 10 ? `\n... and ${entries.length - 10} more` : '';
    const summary = Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ');
    return `**Voyeurr Digest**\n\nSummary: ${summary}\n\n${subjectList}${more}`;
  }

  buildCompactDigest(entries: DigestEntry[]): string {
    if (!entries.length) return 'No updates';
    if (entries.length === 1) return entries[0].payload.subject;
    const subjects = entries.slice(0, 3).map(e => e.payload.subject).join(', ');
    return entries.length > 3 ? `${subjects} +${entries.length - 3} more` : subjects;
  }

  get queueSize(): number { return this.queue.length; }
  clear(): void { this.queue = []; }
}

export const digestEngine = new DigestEngine();
export default digestEngine;
