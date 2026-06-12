import { IssueStatus, IssueTypeName } from '@server/constants/issue';
import { getIntl } from '@server/i18n';
import globalMessages from '@server/i18n/globalMessages';
import type { NotificationAgentApprise } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { AvailableLocale } from '@server/types/languages';
import axios from 'axios';
import { Notification, hasNotificationType } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

/**
 * Apprise Notification Agent
 *
 * Apprise is a unified push notification library supporting 80+ services:
 * Discord, Slack, Telegram, Signal, Matrix, WhatsApp, Pushover, Gotify, ntfy,
 * and dozens more — all through a single HTTP API.
 *
 * Deploy Apprise API alongside Voyeurr:
 *   docker run -d --name apprise -p 8000:8000 caronc/apprise:latest
 *
 * Configure in Voyeurr: Settings → Notifications → Apprise
 */
class AppriseAgent extends BaseAgent<NotificationAgentApprise> implements NotificationAgent {
  protected getSettings(): NotificationAgentApprise {
    if (this.settings) return this.settings;
    const settings = getSettings();
    return settings.notifications.agents.apprise;
  }

  private buildPayload(type: Notification, payload: NotificationPayload) {
    const settings = this.getSettings();
    const intl = getIntl(settings.options.locale as AvailableLocale);
    const { applicationUrl } = getSettings().main;

    const title = payload.event
      ? `${payload.event} - ${payload.subject}`
      : payload.subject;
    let body = payload.message ?? '';

    if (payload.request) {
      body += body ? '\n\n' : '';
      body += `Requested by: ${payload.request.requestedBy.displayName}`;

      let status = '';
      switch (type) {
        case Notification.MEDIA_PENDING: status = intl.formatMessage(globalMessages.pendingApproval); break;
        case Notification.MEDIA_APPROVED:
        case Notification.MEDIA_AUTO_APPROVED: status = intl.formatMessage(globalMessages.processing); break;
        case Notification.MEDIA_AVAILABLE: status = intl.formatMessage(globalMessages.available); break;
        case Notification.MEDIA_DECLINED: status = intl.formatMessage(globalMessages.declined); break;
        case Notification.MEDIA_FAILED: status = intl.formatMessage(globalMessages.failed); break;
      }
      if (status) body += `\nStatus: ${status}`;
    } else if (payload.issue) {
      body += `\n\nReported by: ${payload.issue.createdBy.displayName}`;
      body += `\nType: ${IssueTypeName[payload.issue.issueType]}`;
      body += `\nStatus: ${payload.issue.status === IssueStatus.OPEN ? 'Open' : 'Resolved'}`;
    }

    for (const extra of payload.extra ?? []) {
      body += `\n\n${extra.name}\n${extra.value}`;
    }

    const apprisePayload: Record<string, unknown> = {
      title,
      body,
      type: settings.options.notificationType ?? 'info',
      format: 'text',
    };

    // Attach image if poster embedding is enabled
    if (settings.embedPoster && payload.image) {
      apprisePayload.attach = payload.image;
    }

    // Click URL
    if (applicationUrl && payload.media) {
      apprisePayload.click = `${applicationUrl}/${payload.media.mediaType}/${payload.media.tmdbId}`;
    }

    return apprisePayload;
  }

  public shouldSend(): boolean {
    const settings = this.getSettings();
    return !!(settings.enabled && settings.options.url);
  }

  public async send(type: Notification, payload: NotificationPayload): Promise<boolean> {
    const settings = this.getSettings();

    if (!payload.notifySystem || !hasNotificationType(type, settings.types ?? 0)) {
      return true;
    }

    logger.debug('Sending Apprise notification', {
      label: 'Notifications',
      type: Notification[type],
      subject: payload.subject,
      tags: settings.options.tags,
    });

    try {
      const apprisePayload = this.buildPayload(type, payload);

      // Add tags for routing (comma-separated Apprise tags)
      if (settings.options.tags) {
        apprisePayload.tag = settings.options.tags;
      }

      await axios.post(
        `${settings.options.url}/notify`,
        apprisePayload,
        { timeout: 10_000 }
      );

      return true;
    } catch (e) {
      logger.error('Error sending Apprise notification', {
        label: 'Notifications',
        type: Notification[type],
        subject: payload.subject,
        errorMessage: e.message,
      });
      return false;
    }
  }
}

export default AppriseAgent;
