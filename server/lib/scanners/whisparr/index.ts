import type { WhisparrScene } from '@server/api/servarr/whisparr';
import WhisparrAPI from '@server/api/servarr/whisparr';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type {
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import type { WhisparrSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { uniqWith } from 'lodash';

type SyncStatus = StatusBase & {
  currentServer: WhisparrSettings;
  servers: WhisparrSettings[];
};

class WhisparrScanner
  extends BaseScanner<WhisparrScene>
  implements RunnableScanner<SyncStatus>
{
  private servers: WhisparrSettings[];
  private currentServer: WhisparrSettings;
  private whisparrApi: WhisparrAPI;
  private scannedForeignIds: Set<string> = new Set();
  private scanned4kForeignIds: Set<string> = new Set();
  private didScanStandard = false;
  private didScan4k = false;

  constructor() {
    super('Whisparr Scan', { bundleSize: 50 });
  }

  public status(): SyncStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.items.length,
      currentServer: this.currentServer,
      servers: this.servers,
    };
  }

  public async run(): Promise<void> {
    const settings = getSettings();
    const sessionId = this.startRun();
    this.scannedForeignIds.clear();
    this.scanned4kForeignIds.clear();
    this.didScanStandard = false;
    this.didScan4k = false;

    try {
      this.servers = uniqWith(
        settings.whisparr,
        (a, b) =>
          a.hostname === b.hostname &&
          a.port === b.port &&
          a.baseUrl === b.baseUrl
      );

      for (const server of this.servers) {
        this.currentServer = server;
        if (server.syncEnabled) {
          this.log(`Processing Whisparr: ${server.name}`, 'info');

          this.whisparrApi = new WhisparrAPI({
            apiKey: server.apiKey,
            url: WhisparrAPI.buildUrl(server, '/api/v3'),
          });

          this.items = await this.whisparrApi.getScenes();

          const server4k = this.enable4kMovie && server.is4k;
          if (server4k) this.didScan4k = true;
          else this.didScanStandard = true;

          await this.loop(this.processWhisparrScene.bind(this), { sessionId });
        } else {
          this.log(`Sync disabled. Skipping: ${server.name}`);
        }
      }

      await this.cleanupOrphanedScenes();
      this.log('Whisparr scan complete', 'info');
    } catch (e) {
      this.log('Scan interrupted', 'error', { errorMessage: e.message });
    } finally {
      this.endRun(sessionId);
    }
  }

  private async processWhisparrScene(scene: WhisparrScene): Promise<void> {
    const server4k = this.enable4kMovie && this.currentServer.is4k;

    if (!scene.foreignId) return;

    if (server4k) this.scanned4kForeignIds.add(scene.foreignId);
    else this.scannedForeignIds.add(scene.foreignId);

    try {
      await this.syncScene(scene.foreignId, {
        is4k: server4k,
        serviceId: this.currentServer.id,
        externalServiceId: scene.id,
        externalServiceSlug: scene.titleSlug,
        title: scene.title,
        processing: !scene.hasFile && scene.monitored,
        hasFile: scene.hasFile,
      });
    } catch (e) {
      this.log('Failed to process scene', 'error', {
        errorMessage: e.message,
        title: scene.title,
        foreignId: scene.foreignId,
      });
    }
  }

  private async syncScene(
    foreignId: string,
    opts: {
      is4k: boolean;
      serviceId?: number;
      externalServiceId?: number;
      externalServiceSlug?: string;
      title: string;
      processing: boolean;
      hasFile: boolean;
    }
  ): Promise<void> {
    const mediaRepository = getRepository(Media);

    await this.asyncLock.dispatch(foreignId, async () => {
      const existing = await mediaRepository.findOne({
        where: { externalId: foreignId },
      });

      if (existing) {
        let changed = false;
        const key = opts.is4k ? 'status4k' : 'status';
        const prev = existing[key];

        if (prev !== MediaStatus.AVAILABLE) {
          existing[key] =
            !opts.processing && opts.hasFile
              ? MediaStatus.AVAILABLE
              : !opts.processing && !opts.hasFile && prev === MediaStatus.PROCESSING
                ? MediaStatus.UNKNOWN
                : opts.processing
                  ? prev === MediaStatus.DELETED ? MediaStatus.DELETED : MediaStatus.PROCESSING
                  : prev;
          if (existing[key] !== prev) changed = true;
        }

        const svcKey = opts.is4k ? 'serviceId4k' : 'serviceId';
        const extKey = opts.is4k ? 'externalServiceId4k' : 'externalServiceId';
        const slugKey = opts.is4k ? 'externalServiceSlug4k' : 'externalServiceSlug';

        if (opts.serviceId !== undefined && existing[svcKey] !== opts.serviceId) {
          existing[svcKey] = opts.serviceId; changed = true;
        }
        if (opts.externalServiceId !== undefined && existing[extKey] !== opts.externalServiceId) {
          existing[extKey] = opts.externalServiceId; changed = true;
        }
        if (opts.externalServiceSlug !== undefined && existing[slugKey] !== opts.externalServiceSlug) {
          existing[slugKey] = opts.externalServiceSlug; changed = true;
        }

        if (changed) await mediaRepository.save(existing);
      } else {
        if (!opts.processing && !opts.hasFile) return;

        const newMedia = new Media();
        newMedia.mediaType = MediaType.MOVIE;
        newMedia.tmdbId = 0;
        newMedia.externalId = foreignId;
        newMedia.externalSource = foreignId.includes(':')
          ? foreignId.split(':')[0]
          : 'whisparr';
        newMedia.status = !opts.is4k && !opts.processing
          ? MediaStatus.AVAILABLE : !opts.is4k && opts.processing
            ? MediaStatus.PROCESSING : MediaStatus.UNKNOWN;
        newMedia.status4k = opts.is4k && !opts.processing
          ? MediaStatus.AVAILABLE : opts.is4k && opts.processing
            ? MediaStatus.PROCESSING : MediaStatus.UNKNOWN;
        newMedia.serviceId = !opts.is4k ? opts.serviceId : undefined;
        newMedia.serviceId4k = opts.is4k ? opts.serviceId : undefined;
        newMedia.externalServiceId = !opts.is4k ? opts.externalServiceId : undefined;
        newMedia.externalServiceId4k = opts.is4k ? opts.externalServiceId : undefined;
        newMedia.externalServiceSlug = !opts.is4k ? opts.externalServiceSlug : undefined;
        newMedia.externalServiceSlug4k = opts.is4k ? opts.externalServiceSlug : undefined;

        await mediaRepository.save(newMedia);
        this.log(`Saved new scene: ${opts.title}`);
      }
    });
  }

  private async cleanupOrphanedScenes(): Promise<void> {
    const mediaRepository = getRepository(Media);

    if (this.didScanStandard) {
      const processing = await mediaRepository.find({
        where: { mediaType: MediaType.MOVIE, status: MediaStatus.PROCESSING },
      });
      for (const m of processing) {
        if (m.externalId && !this.scannedForeignIds.has(m.externalId)) {
          m.status = MediaStatus.UNKNOWN;
          await mediaRepository.save(m);
        }
      }
    }

    if (this.didScan4k) {
      const processing4k = await mediaRepository.find({
        where: { mediaType: MediaType.MOVIE, status4k: MediaStatus.PROCESSING },
      });
      for (const m of processing4k) {
        if (m.externalId && !this.scanned4kForeignIds.has(m.externalId)) {
          m.status4k = MediaStatus.UNKNOWN;
          await mediaRepository.save(m);
        }
      }
    }
  }
}

export const whisparrScanner = new WhisparrScanner();
