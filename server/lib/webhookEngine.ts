import { getRepository } from '@server/datasource';
import WebhookSubscription, { WebhookEvent } from '@server/entity/WebhookSubscription';
import WebhookDelivery from '@server/entity/WebhookDelivery';
import logger from '@server/logger';
import crypto from 'crypto';
import axios from 'axios';

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

class WebhookEngine {
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 2_000;

  /** Fire a webhook event — fan out to all matching subscriptions. */
  async fire(event: WebhookEvent, data: Record<string, unknown>) {
    const subs = await getRepository(WebhookSubscription).find({
      where: { enabled: true },
    });

    const matching = subs.filter(s => s.eventList.includes(event));
    if (!matching.length) return;

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    // Fire all webhooks in parallel (non-blocking)
    for (const sub of matching) {
      this.deliver(sub, payload).catch(() => {});
    }
  }

  private async deliver(sub: WebhookSubscription, payload: WebhookPayload, attempt = 1) {
    try {
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Voyeurr-Event': payload.event,
        'X-Voyeurr-Delivery': crypto.randomUUID(),
      };

      // HMAC-SHA256 signing if secret is configured
      if (sub.secret) {
        const signature = crypto.createHmac('sha256', sub.secret).update(body).digest('hex');
        headers['X-Voyeurr-Signature'] = `sha256=${signature}`;
      }

      const response = await axios.post(sub.url, payload, {
        headers,
        timeout: 10_000,
        validateStatus: (s) => s >= 200 && s < 300,
      });

      // Record success
      sub.successCount++;
      sub.lastDeliveryAt = new Date();
      sub.lastError = undefined;
      await getRepository(WebhookSubscription).save(sub);

      await this.recordDelivery(sub.id, payload.event, true, response.status, attempt);

    } catch (e: any) {
      const status = e.response?.status ?? 0;
      const willRetry = attempt < this.MAX_RETRIES && (status >= 500 || status === 0 || status === 429);

      if (willRetry) {
        const delay = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
        logger.debug(`Webhook retry ${attempt}/${this.MAX_RETRIES} in ${delay}ms`, {
          label: 'Webhook', subId: sub.id, url: sub.url,
        });
        await new Promise(r => setTimeout(r, delay));
        return this.deliver(sub, payload, attempt + 1);
      }

      // Record failure
      sub.failureCount++;
      sub.lastError = e.message?.slice(0, 500);
      await getRepository(WebhookSubscription).save(sub);

      await this.recordDelivery(sub.id, payload.event, false, status, attempt, e.message?.slice(0, 500));

      logger.warn('Webhook delivery failed permanently', {
        label: 'Webhook', subId: sub.id, url: sub.url, attempt, status,
        errorMessage: e.message,
      });
    }
  }

  private async recordDelivery(
    subscriptionId: number, event: string, success: boolean,
    responseStatus: number, attempt: number, error?: string,
  ) {
    try {
      const delivery = getRepository(WebhookDelivery).create({
        subscriptionId, event, success, responseStatus, attempt,
        error: error?.slice(0, 500),
      });
      await getRepository(WebhookDelivery).save(delivery);
    } catch {}
  }

  /** Verify a webhook signature. */
  verifySignature(body: string, signature: string, secret: string): boolean {
    try {
      const [scheme, hash] = signature.split('=');
      if (scheme !== 'sha256') return false;
      const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}

export const webhookEngine = new WebhookEngine();
export default webhookEngine;
