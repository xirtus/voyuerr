/**
 * Voyeurr Search Engine — Phase 9 + improvements
 * Full-text search with faceted filtering, similar-scene recommendations,
 * trending algorithm, and autocomplete.
 *
 * Database support:
 *   - PostgreSQL: Uses tsvector GIN indexes + pg_trgm for fuzzy matching
 *   - SQLite: Uses FTS5 virtual tables for full-text search
 *   - Fallback: LIKE-based search for unindexed deployments
 */
import { getRepository } from '@server/datasource';
import { isPgsql } from '@server/datasource';
import Scene from '@server/entity/Scene';
import Performer from '@server/entity/Performer';
import Studio from '@server/entity/Studio';
import { MediaRequest } from '@server/entity/MediaRequest';
import Rating from '@server/entity/Rating';
import WatchHistory from '@server/entity/WatchHistory';
import logger from '@server/logger';

export interface SearchFacets {
  category?: string[];
  performer?: number[];
  studio?: number[];
  quality?: string[];
  year?: { min?: number; max?: number };
  tags?: string[];
  status?: string[];
  source?: string[];
}

export interface SearchOptions {
  query: string;
  page?: number;
  pageSize?: number;
  sort?: 'relevance' | 'newest' | 'oldest' | 'popular' | 'rating' | 'runtime';
  facets?: SearchFacets;
}

export interface SimilarSceneOptions {
  sceneId: number;
  count?: number;
  threshold?: number;
}

export interface TrendingOptions {
  window?: 'day' | 'week' | 'month';
  category?: string;
  limit?: number;
}

const SCENE_SELECT = [
  'Scene.id', 'Scene.title', 'Scene.originalTitle', 'Scene.releaseDate',
  'Scene.releaseYear', 'Scene.runtime', 'Scene.description', 'Scene.posterUrl',
  'Scene.backdropUrl', 'Scene.categories', 'Scene.tags', 'Scene.externalId',
  'Scene.externalSource', 'Scene.status', 'Scene.status4k',
  'studio.id', 'studio.name', 'studio.slug', 'studio.logoUrl',
];

export class SearchEngine {
  /**
   * Full-text search across scenes with faceted filtering.
   * Prefers PostgreSQL tsvector / SQLite FTS5, falls back to LIKE.
   */
  async search(options: SearchOptions) {
    const repo = getRepository(Scene);
    const qb = repo.createQueryBuilder('Scene')
      .leftJoinAndSelect('Scene.studio', 'studio')
      .leftJoinAndSelect('Scene.scenePerformers', 'sp')
      .leftJoinAndSelect('sp.performer', 'performer');

    // Full-text matching
    if (options.query?.trim()) {
      const query = options.query.trim();

      if (isPgsql) {
        // PostgreSQL: use tsvector GIN index with plainto_tsquery for ranking
        qb.andWhere(
          `Scene.search_vector @@ plainto_tsquery('english', :searchQuery)`,
          { searchQuery: query }
        );
        // Add relevance ranking
        qb.addSelect(
          `ts_rank(Scene.search_vector, plainto_tsquery('english', :rankQuery))`,
          'search_rank'
        );
        qb.setParameter('rankQuery', query);
        if (!options.sort || options.sort === 'relevance') {
          qb.orderBy('search_rank', 'DESC');
        }
      } else {
        // SQLite: try FTS5 first, fall back to LIKE
        try {
          // FTS5 with MATCH syntax (SQLite)
          const ftsQuery = query.split(/\s+/).map(t => `"${t}"*`).join(' AND ');
          qb.andWhere(
            `Scene.id IN (SELECT rowid FROM scene_fts WHERE scene_fts MATCH :ftsQuery)`,
            { ftsQuery }
          );
        } catch {
          // Fallback: LIKE-based search
          const terms = query.split(/\s+/).filter(t => t.length > 1);
          if (terms.length > 0) {
            const likeClauses = terms.map((t, i) => {
              const param = `q${i}`;
              return `(Scene.title LIKE :${param} OR Scene.originalTitle LIKE :${param} OR Scene.tags LIKE :${param} OR Scene.description LIKE :${param})`;
            });
            qb.andWhere(`(${likeClauses.join(' AND ')})`,
              Object.fromEntries(terms.map((t, i) => [`q${i}`, `%${t}%`])));
          }
        }
      }
    }

    // Faceted filtering — prefer scene_category join table over LIKE
    if (options.facets?.category?.length) {
      if (isPgsql) {
        // Use the normalized join table when available
        qb.andWhere(
          `Scene.id IN (SELECT sc."sceneId" FROM scene_category sc WHERE sc.category IN (:...cats))`,
          { cats: options.facets.category }
        );
      } else {
        // SQLite fallback: LIKE on comma-separated column
        const catClauses = options.facets.category.map((c, i) => `Scene.categories LIKE :cat${i}`);
        qb.andWhere(`(${catClauses.join(' OR ')})`,
          Object.fromEntries(options.facets.category.map((c, i) => [`cat${i}`, `%${c}%`])));
      }
    }
    if (options.facets?.studio?.length) {
      qb.andWhere('Scene.studioId IN (:...studioIds)', { studioIds: options.facets.studio });
    }
    if (options.facets?.year?.min) {
      qb.andWhere('Scene.releaseYear >= :minYear', { minYear: options.facets.year.min });
    }
    if (options.facets?.year?.max) {
      qb.andWhere('Scene.releaseYear <= :maxYear', { maxYear: options.facets.year.max });
    }
    if (options.facets?.tags?.length) {
      const tagClauses = options.facets.tags.map((t, i) => `Scene.tags LIKE :tag${i}`);
      qb.andWhere(`(${tagClauses.join(' OR ')})`,
        Object.fromEntries(options.facets.tags.map((t, i) => [`tag${i}`, `%${t}%`])));
    }
    if (options.facets?.performer?.length) {
      qb.andWhere('sp.performerId IN (:...perfIds)', { perfIds: options.facets.performer });
    }

    // Sorting
    switch (options.sort) {
      case 'newest': qb.orderBy('Scene.releaseDate', 'DESC'); break;
      case 'oldest': qb.orderBy('Scene.releaseDate', 'ASC'); break;
      case 'runtime': qb.orderBy('Scene.runtime', 'DESC'); break;
      default: qb.orderBy('Scene.releaseDate', 'DESC');
    }

    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 25;
    qb.skip((page - 1) * pageSize).take(pageSize);

    const [results, total] = await qb.getManyAndCount();
    return { results, total, page, pageSize };
  }

  /** Find similar scenes based on tag + performer overlap. */
  async findSimilar(options: SimilarSceneOptions) {
    const repo = getRepository(Scene);
    const source = await repo.findOne({ where: { id: options.sceneId } });
    if (!source) return [];

    const sourceTags = source.tagList;
    const sourcePerformers = source.performers?.map(sp => sp.performerId) ?? [];
    const qb = repo.createQueryBuilder('Scene')
      .leftJoinAndSelect('Scene.studio', 'studio')
      .leftJoinAndSelect('Scene.scenePerformers', 'sp')
      .leftJoinAndSelect('sp.performer', 'performer')
      .where('Scene.id != :id', { id: options.sceneId });

    // Score by tag overlap
    if (sourceTags.length > 0) {
      const tagClauses = sourceTags.map((_, i) => `Scene.tags LIKE :tag${i}`);
      qb.orWhere(`(${tagClauses.join(' OR ')})`,
        Object.fromEntries(sourceTags.map((t, i) => [`tag${i}`, `%${t}%`])));
    }
    // Boost by shared performers
    if (sourcePerformers.length > 0) {
      qb.orWhere('sp.performerId IN (:...perfIds)', { perfIds: sourcePerformers });
    }

    qb.take(options.count ?? 12);
    const results = await qb.getMany();

    // Score and sort
    const scored = results.map(scene => {
      let score = 0;
      const sceneTags = scene.tagList;
      const scenePerfIds = scene.performers?.map(sp => sp.performerId) ?? [];
      // Tag overlap
      const sharedTags = sourceTags.filter(t => sceneTags.includes(t));
      score += sharedTags.length * 10;
      // Performer overlap
      const sharedPerfs = sourcePerformers.filter(p => scenePerfIds.includes(p));
      score += sharedPerfs.length * 20;
      return { scene, score };
    });

    return scored
      .filter(s => s.score >= (options.threshold ?? 5))
      .sort((a, b) => b.score - a.score)
      .slice(0, options.count ?? 12)
      .map(s => s.scene);
  }

  /** Compute trending scenes by weighted recent activity. */
  async getTrending(options: TrendingOptions) {
    const repo = getRepository(Scene);
    const windowDays = options.window === 'day' ? 1 : options.window === 'month' ? 30 : 7;
    const windowMs = windowDays * 86400000;
    const cutoff = new Date(Date.now() - windowMs);

    // Get recent requests
    const reqRepo = getRepository(MediaRequest);
    const recentRequests = await reqRepo
      .createQueryBuilder('req')
      .select('req.mediaId', 'mediaId')
      .addSelect('COUNT(req.id)', 'count')
      .where('req.createdAt >= :cutoff', { cutoff })
      .groupBy('req.mediaId')
      .orderBy('count', 'DESC')
      .take(50)
      .getRawMany();

    // Get recent ratings
    const ratingRepo = getRepository(Rating);
    const recentRatings = await ratingRepo
      .createQueryBuilder('r')
      .select('r.sceneId', 'sceneId')
      .addSelect('AVG(r.score)', 'avgScore')
      .addSelect('COUNT(r.id)', 'count')
      .where('r.createdAt >= :cutoff', { cutoff })
      .groupBy('r.sceneId')
      .getRawMany();

    // Get recent watch history
    const watchRepo = getRepository(WatchHistory);
    const recentWatches = await watchRepo
      .createQueryBuilder('w')
      .select('w.sceneId', 'sceneId')
      .addSelect('COUNT(w.id)', 'count')
      .where('w.lastWatchedAt >= :cutoff', { cutoff })
      .groupBy('w.sceneId')
      .getRawMany();

    // Weighted scoring
    const scores = new Map<number, number>();
    for (const r of recentRequests) scores.set(r.mediaId, (scores.get(r.mediaId) ?? 0) + Number(r.count) * 3);
    for (const r of recentRatings) scores.set(r.sceneId, (scores.get(r.sceneId) ?? 0) + Number(r.avgScore) * 2);
    for (const w of recentWatches) scores.set(w.sceneId, (scores.get(w.sceneId) ?? 0) + Number(w.count) * 1.5);

    const topIds = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, options.limit ?? 24)
      .map(([id]) => id);

    if (!topIds.length) return [];

    const scenes = await repo.findByIds(topIds, {
      relations: ['studio', 'scenePerformers', 'scenePerformers.performer'],
    });

    // Re-sort by score
    const sceneMap = new Map(scenes.map(s => [s.id, s]));
    return topIds.map(id => sceneMap.get(id)).filter(Boolean) as Scene[];
  }

  /** Autocomplete suggestions for search input. */
  async autocomplete(query: string, limit = 8) {
    if (!query?.trim() || query.length < 2) return { scenes: [], performers: [], studios: [] };

    const sceneRepo = getRepository(Scene);
    const perfRepo = getRepository(Performer);
    const studioRepo = getRepository(Studio);

    const searchQuery = query.trim();
    const likeQ = `%${searchQuery}%`;

    // PostgreSQL: use similarity() with pg_trgm for fuzzy matching
    // SQLite: fall back to LIKE
    const sceneQb = sceneRepo.createQueryBuilder('s')
      .select(['s.id', 's.title', 's.posterUrl', 's.releaseYear'])
      .orderBy('s.releaseDate', 'DESC').take(limit);

    const perfQb = perfRepo.createQueryBuilder('p')
      .select(['p.id', 'p.name', 'p.imageUrl'])
      .orderBy('p.popularity', 'DESC').take(5);

    const studioQb = studioRepo.createQueryBuilder('st')
      .select(['st.id', 'st.name', 'st.slug', 'st.logoUrl'])
      .orderBy('st.sceneCount', 'DESC').take(5);

    if (isPgsql) {
      // Use pg_trgm similarity for better fuzzy matching
      sceneQb
        .where('s.title % :q', { q: searchQuery })
        .addSelect('similarity(s.title, :simQ)', 'sim')
        .setParameter('simQ', searchQuery)
        .orderBy('sim', 'DESC');
      perfQb
        .where('p.name % :q', { q: searchQuery })
        .addSelect('similarity(p.name, :simQ)', 'sim')
        .setParameter('simQ', searchQuery)
        .orderBy('sim', 'DESC');
      studioQb
        .where('st.name % :q', { q: searchQuery })
        .addSelect('similarity(st.name, :simQ)', 'sim')
        .setParameter('simQ', searchQuery)
        .orderBy('sim', 'DESC');
    } else {
      sceneQb.where('s.title LIKE :q', { q: likeQ });
      perfQb.where('p.name LIKE :q', { q: likeQ });
      studioQb.where('st.name LIKE :q', { q: likeQ });
    }

    const [scenes, performers, studios] = await Promise.all([
      sceneQb.getMany(),
      perfQb.getMany(),
      studioQb.getMany(),
    ]);

    return { scenes, performers, studios };
  }

  /** "More Like This" — performer-based and studio-based suggestions. */
  async moreLikeThis(entityType: 'performer' | 'studio', entityId: number, limit = 12) {
    const sceneRepo = getRepository(Scene);

    if (entityType === 'performer') {
      return sceneRepo.createQueryBuilder('Scene')
        .leftJoinAndSelect('Scene.studio', 'studio')
        .leftJoinAndSelect('Scene.scenePerformers', 'sp')
        .leftJoinAndSelect('sp.performer', 'performer')
        .where('sp.performerId = :pid', { pid: entityId })
        .orderBy('Scene.releaseDate', 'DESC')
        .take(limit).getMany();
    }

    return sceneRepo.createQueryBuilder('Scene')
      .leftJoinAndSelect('Scene.studio', 'studio')
      .where('Scene.studioId = :sid', { sid: entityId })
      .orderBy('Scene.releaseDate', 'DESC')
      .take(limit).getMany();
  }
}

export const searchEngine = new SearchEngine();
export default searchEngine;
