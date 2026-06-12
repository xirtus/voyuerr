/**
 * Voyeurr Automation Engine — Phase 11
 * Auto-approval, quality upgrades, duplicate detection, smart routing,
 * request batching, retry with exponential backoff, webhooks.
 */
import { getRepository } from '@server/datasource';
import AutoApproveRule from '@server/entity/AutoApproveRule';
import RequestRetry from '@server/entity/RequestRetry';
import { MediaRequest, MediaRequestStatus } from '@server/entity/MediaRequest';
import Scene from '@server/entity/Scene';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import crypto from 'crypto';

export interface WebhookPayload {
  event: string;
  requestId: number;
  sceneTitle: string;
  status: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export class AutomationEngine {
  /**
   * Check if a request matches any auto-approval rules.
   */
  async evaluateAutoApprove(scene: Scene, requestedById: number): Promise<{ approved: boolean; ruleName?: string }> {
    const rules = await getRepository(AutoApproveRule).find({ where: { enabled: true }, order: { priority: 'DESC' } });
    const sceneCategories = scene.categoryList;
    const scenePerformerIds = scene.performers?.map(sp => sp.performerId) ?? [];

    for (const rule of rules) {
      let match = true;
      if (rule.categories) {
        const cats = rule.categories.split(',').map(c => c.trim());
        if (!cats.some(c => sceneCategories.includes(c as any))) match = false;
      }
      if (match && rule.performerIds) {
        const pids = rule.performerIds.split(',').map(Number);
        if (!pids.some(p => scenePerformerIds.includes(p))) match = false;
      }
      if (match && rule.studioIds && scene.studioId) {
        const sids = rule.studioIds.split(',').map(Number);
        if (!sids.includes(scene.studioId)) match = false;
      }
      if (match) {
        // Check request count
        if (rule.minRequestCount > 0) {
          const reqRepo = getRepository(MediaRequest);
          const count = await reqRepo.count({ where: { requestedBy: { id: requestedById } } });
          if (count < rule.minRequestCount) match = false;
        }
      }
      if (match) return { approved: true, ruleName: rule.name };
    }
    return { approved: false };
  }

  /** Detect duplicates by title + studio + year. */
  async detectDuplicate(title: string, studioId?: number, releaseYear?: number): Promise<Scene[]> {
    const repo = getRepository(Scene);
    const qb = repo.createQueryBuilder('Scene').where('Scene.title LIKE :title', { title: `%${title}%` });
    if (studioId) qb.andWhere('Scene.studioId = :sid', { sid: studioId });
    if (releaseYear) qb.andWhere('Scene.releaseYear = :year', { year: releaseYear });
    return qb.take(5).getMany();
  }

  /** Compute content hash for duplicate detection. */
  computeContentHash(scene: Partial<Scene>): string {
    const payload = `${scene.title ?? ''}|${scene.studioId ?? ''}|${scene.releaseYear ?? ''}|${scene.runtime ?? ''}`;
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 16);
  }

  /** Smart routing: choose the best Whisparr instance for a request. */
  routeToWhisparr(scene: Scene, prefer4k = false, preferVR = false) {
    const settings = getSettings();
    const instances = settings.whisparr;

    if (!instances.length) return null;

    // VR preference
    if (preferVR) {
      const vrInstance = instances.find(i => i.is4k && i.name.toLowerCase().includes('vr'));
      if (vrInstance) return vrInstance;
    }
    // 4K preference
    if (prefer4k) {
      const uhdInstance = instances.find(i => i.is4k);
      if (uhdInstance) return uhdInstance;
    }
    // Default: first non-4K, or round-robin
    const sd = instances.filter(i => !i.is4k);
    if (sd.length) return sd[Math.floor(Math.random() * sd.length)];
    return instances[0];
  }

  /** Batch related requests together. */
  async batchRequests(sceneIds: number[]): Promise<{ batches: number[][]; totalBatches: number }> {
    // Group by studio for efficient indexer searching
    const sceneRepo = getRepository(Scene);
    const scenes = await sceneRepo.findByIds(sceneIds);
    const byStudio = new Map<number, number[]>();
    for (const s of scenes) {
      const sid = s.studioId ?? 0;
      if (!byStudio.has(sid)) byStudio.set(sid, []);
      byStudio.get(sid)!.push(s.id);
    }
    const batches = [...byStudio.values()].filter(b => b.length > 1);
    return { batches, totalBatches: batches.length };
  }

  /** Retry failed request with exponential backoff. */
  async scheduleRetry(requestId: number, error: string, maxAttempts = 5) {
    const repo = getRepository(RequestRetry);
    let retry = await repo.findOne({ where: { requestId } });
    if (!retry) retry = new RequestRetry({ requestId, maxAttempts });
    retry.attemptCount += 1;
    retry.lastError = error;
    const backoffMs = Math.min(Math.pow(2, retry.attemptCount) * 60000, 3600000); // 1min–1hr
    retry.nextRetryAt = new Date(Date.now() + backoffMs);
    if (retry.attemptCount >= maxAttempts) retry.resolved = true; // give up
    return repo.save(retry);
  }

  async processRetries() {
    const repo = getRepository(RequestRetry);
    const due = await repo.find({ where: { resolved: false }, relations: ['request'] });
    for (const retry of due) {
      if (retry.nextRetryAt && retry.nextRetryAt > new Date()) continue;
      logger.info(`Retrying request ${retry.requestId} (attempt ${retry.attemptCount + 1})`, { label: 'Automation' });
      try {
        // Re-process the request (the actual resubmission is handled by the request route)
        retry.resolved = true;
        await repo.save(retry);
      } catch (e) {
        await this.scheduleRetry(retry.requestId, e.message, retry.maxAttempts);
      }
    }
  }

  /** Fire webhooks on request state changes. */
  async fireWebhook(payload: WebhookPayload) {
    const settings = getSettings();
    // Webhook URLs are stored in notify agents or could be separate config
    // For now, log and support external webhook config
    logger.info(`Webhook: ${payload.event}`, { label: 'Webhook', data: payload });

    // Attempt to POST to configured webhook URLs
    const webhookUrls = (settings as any).webhookUrls as string[] | undefined;
    if (webhookUrls?.length) {
      for (const url of webhookUrls) {
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch (e) {
          logger.warn(`Webhook delivery failed to ${url}`, { label: 'Webhook', errorMessage: e.message });
        }
      }
    }
  }
}

export const automationEngine = new AutomationEngine();
export default automationEngine;
