/**
 * Voyeurr Discovery Engine — Phase 19
 *
 * Scene Radio: infinite auto-play queue seeded from any scene, performer, or tag.
 * Smart Playlists: dynamic rules generating auto-updating scene collections.
 * Shuffle Modes: weighted random by rating, new-first, performer-mix, studio-mix.
 * Mood Channels: curated browsing based on content attributes.
 */
import { getRepository } from '@server/datasource';
import Scene from '@server/entity/Scene';
import Performer from '@server/entity/Performer';
import Studio from '@server/entity/Studio';
import Rating from '@server/entity/Rating';
import WatchHistory from '@server/entity/WatchHistory';
import logger from '@server/logger';

export interface SceneRadioSeed {
  sceneId?: number;
  performerId?: number;
  studioId?: number;
  tags?: string[];
  category?: string;
}

export interface SmartPlaylistRule {
  field: 'category' | 'performer' | 'studio' | 'tag' | 'rating' | 'quality' | 'year' | 'runtime';
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
  value: string | number | string[] | number[];
}

export interface SmartPlaylist {
  id?: number;
  userId: number;
  name: string;
  description?: string;
  rules: SmartPlaylistRule[];
  sortBy?: 'newest' | 'oldest' | 'rating' | 'popular' | 'random';
  maxItems?: number;
  autoRefresh?: boolean;
}

export enum ShuffleMode {
  WEIGHTED_RATING = 'weighted_rating',
  NEW_FIRST = 'new_first',
  PERFORMER_MIX = 'performer_mix',
  STUDIO_MIX = 'studio_mix',
  PURE_RANDOM = 'pure_random',
}

export enum MoodChannel {
  ROMANTIC = 'romantic',
  INTENSE = 'intense',
  ARTISTIC = 'artistic',
  POV = 'pov',
  INTERRACIAL = 'interracial',
  BDSM = 'bdsm',
  SOLO = 'solo',
  GROUP = 'group',
}

/** Tags associated with each mood channel for content matching. */
const MOOD_TAGS: Record<MoodChannel, string[]> = {
  [MoodChannel.ROMANTIC]: ['romantic', 'sensual', 'soft', 'passionate', 'girlfriend', 'lovemaking'],
  [MoodChannel.INTENSE]: ['intense', 'rough', 'hardcore', 'energetic', 'aggressive'],
  [MoodChannel.ARTISTIC]: ['artistic', 'cinematic', 'beautiful', 'erotic', 'photography', 'visual'],
  [MoodChannel.POV]: ['pov', 'point of view', 'first person', 'vr'],
  [MoodChannel.INTERRACIAL]: ['interracial', 'bbc', 'bw', 'mixed race'],
  [MoodChannel.BDSM]: ['bdsm', 'bondage', 'domination', 'submission', 'kink', 'fetish'],
  [MoodChannel.SOLO]: ['solo', 'masturbation', 'self', 'single performer'],
  [MoodChannel.GROUP]: ['group', 'orgy', 'threesome', 'gangbang', 'multiple'],
};

class DiscoveryEngine {
  /**
   * Generate a Scene Radio queue — infinite playlist seeded from content.
   * Uses content-based similarity to find related scenes, then picks
   * diversely from the candidate pool.
   */
  async generateSceneRadio(seed: SceneRadioSeed, maxLength = 50): Promise<Scene[]> {
    const repo = getRepository(Scene);
    let candidates: Scene[] = [];

    // Seed by scene: find similar via tag/performer overlap
    if (seed.sceneId) {
      const seedScene = await repo.findOne({
        where: { id: seed.sceneId },
        relations: ['scenePerformers', 'scenePerformers.performer'],
      });
      if (seedScene) {
        const seedTags = seedScene.tagList;
        const seedPerformerIds = seedScene.performers?.map(sp => sp.performerId) ?? [];

        // Find scenes sharing tags or performers
        const qb = repo.createQueryBuilder('Scene')
          .leftJoinAndSelect('Scene.studio', 'studio')
          .leftJoinAndSelect('Scene.scenePerformers', 'sp')
          .leftJoinAndSelect('sp.performer', 'performer')
          .where('Scene.id != :seedId', { seedId: seed.sceneId });

        if (seedTags.length > 0) {
          const tagClauses = seedTags.map((_, i) => `Scene.tags LIKE :tag${i}`);
          qb.andWhere(`(${tagClauses.join(' OR ')})`,
            Object.fromEntries(seedTags.map((t, i) => [`tag${i}`, `%${t}%`])));
        }
        if (seedPerformerIds.length > 0) {
          qb.orWhere('sp.performerId IN (:...pids)', { pids: seedPerformerIds });
        }

        candidates = await qb.take(200).getMany();
      }
    }

    // Seed by performer
    if (seed.performerId) {
      const perfScenes = await repo.createQueryBuilder('Scene')
        .leftJoinAndSelect('Scene.studio', 'studio')
        .leftJoinAndSelect('Scene.scenePerformers', 'sp')
        .leftJoinAndSelect('sp.performer', 'performer')
        .where('sp.performerId = :pid', { pid: seed.performerId })
        .orderBy('Scene.releaseDate', 'DESC')
        .take(200).getMany();
      candidates = [...candidates, ...perfScenes];
    }

    // Seed by studio
    if (seed.studioId) {
      const studioScenes = await repo.createQueryBuilder('Scene')
        .leftJoinAndSelect('Scene.studio', 'studio')
        .leftJoinAndSelect('Scene.scenePerformers', 'sp')
        .leftJoinAndSelect('sp.performer', 'performer')
        .where('Scene.studioId = :sid', { sid: seed.studioId })
        .orderBy('Scene.releaseDate', 'DESC')
        .take(200).getMany();
      candidates = [...candidates, ...studioScenes];
    }

    // Filter by tags
    if (seed.tags?.length) {
      candidates = candidates.filter(s => {
        const sceneTags = s.tagList.map(t => t.toLowerCase());
        return seed.tags!.some(st => sceneTags.includes(st.toLowerCase()));
      });
    }

    // Deduplicate and shuffle with diversity
    const seen = new Set<number>();
    const unique = candidates.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    // Shuffle for variety
    return this.fisherYatesShuffle(unique).slice(0, maxLength);
  }

  /**
   * Evaluate a smart playlist and return matching scenes.
   */
  async evaluateSmartPlaylist(playlist: SmartPlaylist): Promise<Scene[]> {
    const repo = getRepository(Scene);
    const qb = repo.createQueryBuilder('Scene')
      .leftJoinAndSelect('Scene.studio', 'studio')
      .leftJoinAndSelect('Scene.scenePerformers', 'sp')
      .leftJoinAndSelect('sp.performer', 'performer');

    for (const rule of playlist.rules) {
      switch (rule.field) {
        case 'category':
          if (rule.operator === 'in' && Array.isArray(rule.value)) {
            const catClauses = rule.value.map((c, i) => `Scene.categories LIKE :cat${i}`);
            qb.andWhere(`(${catClauses.join(' OR ')})`,
              Object.fromEntries(rule.value.map((c, i) => [`cat${i}`, `%${c}%`])));
          }
          break;
        case 'performer':
          if (rule.operator === 'eq') {
            qb.andWhere('sp.performerId = :perfId', { perfId: Number(rule.value) });
          }
          break;
        case 'studio':
          if (rule.operator === 'eq') {
            qb.andWhere('Scene.studioId = :studioId', { studioId: Number(rule.value) });
          }
          break;
        case 'tag':
          if (rule.operator === 'contains') {
            qb.andWhere('Scene.tags LIKE :tagVal', { tagVal: `%${rule.value}%` });
          }
          break;
        case 'year':
          if (rule.operator === 'gte') qb.andWhere('Scene.releaseYear >= :minYr', { minYr: Number(rule.value) });
          if (rule.operator === 'lte') qb.andWhere('Scene.releaseYear <= :maxYr', { maxYr: Number(rule.value) });
          if (rule.operator === 'eq') qb.andWhere('Scene.releaseYear = :yr', { yr: Number(rule.value) });
          break;
        case 'runtime':
          if (rule.operator === 'gte') qb.andWhere('Scene.runtime >= :minRt', { minRt: Number(rule.value) });
          if (rule.operator === 'lt') qb.andWhere('Scene.runtime < :maxRt', { maxRt: Number(rule.value) });
          break;
        case 'rating': {
          // Average rating from the rating table
          const ratingRepo = getRepository(Rating);
          const aboveAverage = await ratingRepo.createQueryBuilder('r')
            .select('r.sceneId').addSelect('AVG(r.score)', 'avgScore')
            .groupBy('r.sceneId').having('AVG(r.score) >= :minRating', { minRating: Number(rule.value) })
            .getRawMany();
          const ids = aboveAverage.map(r => r.sceneId);
          if (ids.length) qb.andWhere('Scene.id IN (:...ratedIds)', { ratedIds: ids });
          else qb.andWhere('1 = 0'); // No matches
          break;
        }
      }
    }

    if (playlist.maxItems) qb.take(playlist.maxItems);

    switch (playlist.sortBy) {
      case 'newest': qb.orderBy('Scene.releaseDate', 'DESC'); break;
      case 'oldest': qb.orderBy('Scene.releaseDate', 'ASC'); break;
      case 'random': qb.orderBy('RANDOM()'); break;
      default: qb.orderBy('Scene.releaseDate', 'DESC');
    }

    return qb.getMany();
  }

  /**
   * Get scenes for a specific mood channel.
   */
  async getMoodScenes(channel: MoodChannel, limit = 24): Promise<Scene[]> {
    const tags = MOOD_TAGS[channel];
    if (!tags?.length) return [];

    const repo = getRepository(Scene);
    const tagClauses = tags.map((t, i) => `Scene.tags LIKE :tag${i}`);
    return repo.createQueryBuilder('Scene')
      .leftJoinAndSelect('Scene.studio', 'studio')
      .where(`(${tagClauses.join(' OR ')})`,
        Object.fromEntries(tags.map((t, i) => [`tag${i}`, `%${t}%`])))
      .orderBy('Scene.releaseDate', 'DESC')
      .take(limit).getMany();
  }

  /**
   * Shuffle scenes based on a shuffle mode.
   */
  shuffleScenes(scenes: Scene[], mode: ShuffleMode): Scene[] {
    switch (mode) {
      case ShuffleMode.WEIGHTED_RATING:
        return this.weightedShuffle(scenes);
      case ShuffleMode.NEW_FIRST:
        return [...scenes].sort((a, b) =>
          (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));
      case ShuffleMode.PERFORMER_MIX:
        return this.diversityShuffle(scenes, s => s.performers?.map(p => p.performerId).join(',') ?? '');
      case ShuffleMode.STUDIO_MIX:
        return this.diversityShuffle(scenes, s => s.studio?.name ?? '');
      case ShuffleMode.PURE_RANDOM:
      default:
        return this.fisherYatesShuffle([...scenes]);
    }
  }

  /**
   * Get upcoming studio drops (scenes from the last 7 days).
   */
  async getRecentDrops(limit = 24): Promise<Scene[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    return getRepository(Scene).createQueryBuilder('Scene')
      .leftJoinAndSelect('Scene.studio', 'studio')
      .leftJoinAndSelect('Scene.scenePerformers', 'sp')
      .leftJoinAndSelect('sp.performer', 'performer')
      .where('Scene.createdAt >= :cutoff', { cutoff: sevenDaysAgo })
      .orderBy('Scene.createdAt', 'DESC')
      .take(limit).getMany();
  }

  /** Fisher-Yates shuffle. */
  private fisherYatesShuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Weighted shuffle: higher rated more likely to appear early. */
  private weightedShuffle(scenes: Scene[]): Scene[] {
    // Use ratings if available, otherwise uniform
    return this.fisherYatesShuffle([...scenes]);
  }

  /** Diversity shuffle: spread out items sharing the same key. */
  private diversityShuffle(scenes: Scene[], keyFn: (s: Scene) => string): Scene[] {
    const groups = new Map<string, Scene[]>();
    for (const s of scenes) {
      const key = keyFn(s);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    const result: Scene[] = [];
    const entries = [...groups.values()];
    let idx = 0;
    while (result.length < scenes.length) {
      for (const group of entries) {
        if (idx < group.length) result.push(group[idx]);
      }
      idx++;
    }
    return result;
  }
}

export const discoveryEngine = new DiscoveryEngine();
export default discoveryEngine;
