import StashAPI from '@server/api/stash';
import type { StashPerformer, StashScene, StashStudio } from '@server/api/stash';
import {
  ContentType,
  PerformerGender,
  PerformerRole,
  StudioNetworkType,
  SceneStatus,
} from '@server/constants/content';
import { getRepository } from '@server/datasource';
import Performer from '@server/entity/Performer';
import Scene from '@server/entity/Scene';
import ScenePerformer from '@server/entity/ScenePerformer';
import Studio from '@server/entity/Studio';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

class StashSync {
  private stashClient: StashAPI | null = null;
  public running = false;

  private mapGender(gender?: string): PerformerGender {
    switch (gender?.toUpperCase()) {
      case 'MALE': return PerformerGender.MALE;
      case 'TRANSGENDER_MALE':
      case 'TRANSGENDER_FEMALE': return PerformerGender.TRANSGENDER;
      case 'INTERSEX': return PerformerGender.INTERSEX;
      case 'NON_BINARY': return PerformerGender.NON_BINARY;
      default: return PerformerGender.FEMALE;
    }
  }

  private inferContentType(scene: StashScene): ContentType {
    const tags = scene.tags?.map((t) => t.name.toLowerCase()) ?? [];
    if (tags.includes('jav')) return ContentType.JAV;
    if (tags.includes('hentai') || tags.includes('anime')) return ContentType.HENTAI;
    if (tags.includes('vr')) return ContentType.VR;
    if (tags.includes('amateur')) return ContentType.AMATEUR;
    if (scene.file?.width && scene.file.width >= 3840) return ContentType.UHD;
    return ContentType.SCENE;
  }

  async syncPerformers(): Promise<number> {
    if (!this.stashClient) return 0;
    const performerRepository = getRepository(Performer);
    let synced = 0;

    try {
      const stashPerformers = await this.stashClient.findPerformers({ per_page: 200 });
      for (const sp of stashPerformers) {
        let performer = await performerRepository.findOne({ where: { name: sp.name } });
        if (!performer) {
          performer = new Performer({
            name: sp.name,
            aliases: sp.alias_list ? JSON.stringify(sp.alias_list) : undefined,
            birthDate: sp.birthdate || undefined,
            bio: sp.details || undefined,
            gender: this.mapGender(sp.gender),
            imageUrl: sp.image_path || undefined,
            country: sp.country || undefined,
            height: sp.height_cm,
            weight: sp.weight,
            measurements: sp.measurements || undefined,
            sceneCount: sp.scene_count ?? 0,
            active: true,
            adult: true,
            popularity: sp.rating100 ?? 0,
          });
          await performerRepository.save(performer);
          synced++;
        } else {
          let changed = false;
          if (sp.image_path && performer.imageUrl !== sp.image_path) { performer.imageUrl = sp.image_path; changed = true; }
          if (sp.details && performer.bio !== sp.details) { performer.bio = sp.details; changed = true; }
          if (sp.scene_count !== undefined && performer.sceneCount !== sp.scene_count) { performer.sceneCount = sp.scene_count; changed = true; }
          if (sp.rating100 !== undefined && performer.popularity !== sp.rating100) { performer.popularity = sp.rating100; changed = true; }
          if (changed) { await performerRepository.save(performer); synced++; }
        }
      }
      logger.info(`Stash performers synced: ${synced}`, { label: 'StashSync' });
      return synced;
    } catch (e) {
      logger.error('Stash performer sync failed', { label: 'StashSync', errorMessage: e.message });
      throw e;
    }
  }

  async syncStudios(): Promise<number> {
    if (!this.stashClient) return 0;
    const studioRepository = getRepository(Studio);
    let synced = 0;

    try {
      const stashStudios = await this.stashClient.findStudios({ per_page: 200 });
      for (const ss of stashStudios) {
        const slug = ss.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let studio = await studioRepository.findOne({ where: { slug } });
        if (!studio) {
          studio = new Studio({
            name: ss.name,
            slug,
            description: ss.details || undefined,
            logoUrl: ss.image_path || undefined,
            websiteUrl: ss.url || undefined,
            networkType: StudioNetworkType.INDEPENDENT,
            sceneCount: ss.scene_count ?? 0,
            popularity: ss.rating100 ?? 0,
          });
          await studioRepository.save(studio);
          synced++;
        } else {
          let changed = false;
          if (ss.image_path && studio.logoUrl !== ss.image_path) { studio.logoUrl = ss.image_path; changed = true; }
          if (ss.details && studio.description !== ss.details) { studio.description = ss.details; changed = true; }
          if (changed) { await studioRepository.save(studio); synced++; }
        }
      }
      logger.info(`Stash studios synced: ${synced}`, { label: 'StashSync' });
      return synced;
    } catch (e) {
      logger.error('Stash studio sync failed', { label: 'StashSync', errorMessage: e.message });
      throw e;
    }
  }

  async syncScenes(): Promise<number> {
    if (!this.stashClient) return 0;
    const sceneRepository = getRepository(Scene);
    const studioRepository = getRepository(Studio);
    const performerRepository = getRepository(Performer);
    const scenePerformerRepository = getRepository(ScenePerformer);
    let synced = 0;

    try {
      const stashScenes = await this.stashClient.findScenes({ per_page: 100 });
      for (const ss of stashScenes) {
        let studio: Studio | undefined;
        if (ss.studio?.name) {
          const slug = ss.studio.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          studio = await studioRepository.findOne({ where: { slug } });
          if (!studio) {
            studio = new Studio({ name: ss.studio.name, slug, logoUrl: ss.studio.image_path || undefined, networkType: StudioNetworkType.INDEPENDENT });
            await studioRepository.save(studio);
          }
        }

        const externalId = `stash:${ss.id}`;
        let scene = await sceneRepository.findOne({ where: { externalId, externalSource: 'stash' } });
        const contentType = this.inferContentType(ss);

        if (!scene) {
          scene = new Scene({
            contentType,
            title: ss.title || ss.path?.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled',
            description: ss.details || undefined,
            releaseDate: ss.date || undefined,
            releaseYear: ss.date ? new Date(ss.date).getFullYear() : undefined,
            runtime: ss.file?.duration ? Math.round(ss.file.duration / 60) : undefined,
            externalId, externalSource: 'stash',
            tags: ss.tags?.map((t) => t.name).join(',') || undefined,
            posterUrl: ss.image_path || undefined,
            status: SceneStatus.AVAILABLE,
            studioId: studio?.id,
          });
          await sceneRepository.save(scene);
          synced++;
        }

        if (ss.performers?.length && scene) {
          for (const sp of ss.performers) {
            let performer = await performerRepository.findOne({ where: { name: sp.name } });
            if (!performer) {
              performer = new Performer({ name: sp.name, imageUrl: sp.image_path || undefined, gender: PerformerGender.FEMALE, adult: true });
              await performerRepository.save(performer);
            }
            const existing = await scenePerformerRepository.findOne({ where: { sceneId: scene.id, performerId: performer.id } });
            if (!existing) {
              await scenePerformerRepository.save(new ScenePerformer({ sceneId: scene.id, performerId: performer.id, role: PerformerRole.STARRING, sortOrder: 0 }));
            }
          }
        }
      }
      logger.info(`Stash scenes synced: ${synced}`, { label: 'StashSync' });
      return synced;
    } catch (e) {
      logger.error('Stash scene sync failed', { label: 'StashSync', errorMessage: e.message });
      throw e;
    }
  }

  async run(): Promise<{ performers: number; studios: number; scenes: number }> {
    const settings = getSettings();
    this.running = true;

    const stashSettings = (settings as any).stash;
    if (!stashSettings?.enabled || !stashSettings?.hostname) {
      logger.info('Stash not configured. Skipping sync.', { label: 'StashSync' });
      this.running = false;
      return { performers: 0, studios: 0, scenes: 0 };
    }

    try {
      const proto = stashSettings.useSsl ? 'https' : 'http';
      const hostname = `${proto}://${stashSettings.hostname}:${stashSettings.port || 9999}`;
      this.stashClient = new StashAPI(hostname, stashSettings.apiKey);

      const connected = await this.stashClient.testConnection();
      if (!connected) throw new Error('Stash connection test failed');

      logger.info('Stash sync starting...', { label: 'StashSync' });
      const performers = await this.syncPerformers();
      const studios = await this.syncStudios();
      const scenes = await this.syncScenes();
      logger.info(`Stash sync done: ${performers}p ${studios}s ${scenes}c`, { label: 'StashSync' });
      return { performers, studios, scenes };
    } catch (e) {
      logger.error('Stash sync failed', { label: 'StashSync', errorMessage: e.message });
      throw e;
    } finally {
      this.running = false;
    }
  }
}

export const stashSync = new StashSync();
export default stashSync;
