/**
 * ThePornDB API Client
 *
 * Interfaces with api.theporndb.net — the adult metadata database.
 * Provides scene search, performer lookup, studio info, tags, and trailers.
 *
 * API Base: https://api.theporndb.net
 * Docs: https://api.theporndb.net/docs
 *
 * Phase 8 — Metadata Provider Integration
 */

import ExternalAPI from '@server/api/externalapi';
import type { ContentCategory, PerformerGender } from '@server/constants/content';
import logger from '@server/logger';
import { AdultMetadataSource } from './types';
import type {
  AdultPerformerInfo,
  AdultPerformerResult,
  AdultSceneResult,
  AdultSearchQuery,
  AdultStudioInfo,
} from './types';

/** ThePornDB performer object. */
interface TPDBPerformer {
  id: string;
  name: string;
  image_url?: string;
  aliases?: string[];
  gender?: string;
  birthdate?: string;
  birthplace?: string;
  height?: number;
  weight?: number;
  measurements?: string;
  bio?: string;
  active?: boolean;
  scene_count?: number;
  popularity?: number;
  social_media?: Record<string, string>;
}

/** ThePornDB scene object. */
interface TPDBScene {
  id: string;
  title: string;
  original_title?: string;
  description?: string;
  release_date?: string;
  runtime?: number;
  poster_url?: string;
  backdrop_url?: string;
  trailer_url?: string;
  categories?: { id: string; name: string }[];
  tags?: { id: string; name: string }[];
  studio?: {
    id: string;
    name: string;
    logo_url?: string;
    external_id?: string;
  };
  performers?: TPDBPerformer[];
  url?: string;
  rating?: number;
  view_count?: number;
}

/** ThePornDB paginated response. */
interface TPDBSearchResponse {
  data: TPDBScene[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/** ThePornDB performer search response. */
interface TPDBPerformerSearchResponse {
  data: TPDBPerformer[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/** Mapping from ThePornDB gender strings to internal enum. */
const TPDB_GENDER_MAP: Record<string, PerformerGender> = {
  female: PerformerGender.FEMALE,
  male: PerformerGender.MALE,
  transgender: PerformerGender.TRANSGENDER,
  'non-binary': PerformerGender.NON_BINARY,
  intersex: PerformerGender.INTERSEX,
};

/** Map ThePornDB category names to internal ContentCategory. */
const TPDB_CATEGORY_MAP: Record<string, ContentCategory> = {
  western: ContentCategory.WESTERN,
  jav: ContentCategory.JAV,
  'japanese adult video': ContentCategory.JAV,
  hentai: ContentCategory.HENTAI,
  anime: ContentCategory.HENTAI,
  amateur: ContentCategory.AMATEUR,
  vr: ContentCategory.VR,
  'virtual reality': ContentCategory.VR,
  gay: ContentCategory.GAY,
  trans: ContentCategory.TRANS,
  transgender: ContentCategory.TRANS,
  queer: ContentCategory.QUEER,
  uhd: ContentCategory.UHD,
  '4k': ContentCategory.UHD,
  uncensored: ContentCategory.UNCENSORED,
  leaked: ContentCategory.LEAKED,
  'high fps': ContentCategory.HIGH_FPS,
  '60fps': ContentCategory.HIGH_FPS,
};

class ThePornDB extends ExternalAPI {
  static readonly SOURCE = AdultMetadataSource.TPDB;
  static readonly BASE_URL = 'https://api.theporndb.net';

  constructor(apiKey?: string) {
    super(
      ThePornDB.BASE_URL,
      {},
      {
        headers: {
          Authorization: `Bearer ${apiKey ?? ''}`,
        },
        rateLimit: { maxRPS: 2, maxRequests: 30 },
        timeout: 15000,
      }
    );
  }

  // --- Helpers ---

  private mapPerformer(p: TPDBPerformer): AdultPerformerInfo {
    return {
      name: p.name,
      externalId: p.id,
      source: AdultMetadataSource.TPDB,
      imageUrl: p.image_url,
      gender: p.gender ? (TPDB_GENDER_MAP[p.gender.toLowerCase()] ?? PerformerGender.FEMALE) : undefined,
    };
  }

  private mapPerformerFull(p: TPDBPerformer): AdultPerformerResult {
    return {
      source: AdultMetadataSource.TPDB,
      sourceId: p.id,
      name: p.name,
      aliases: p.aliases ?? [],
      birthDate: p.birthdate,
      bio: p.bio,
      gender: p.gender
        ? (TPDB_GENDER_MAP[p.gender.toLowerCase()] ?? PerformerGender.FEMALE)
        : PerformerGender.FEMALE,
      imageUrl: p.image_url,
      country: p.birthplace,
      height: p.height,
      weight: p.weight,
      measurements: p.measurements,
      sceneCount: p.scene_count ?? 0,
      active: p.active ?? true,
      popularity: p.popularity ?? 0,
      socialMedia: p.social_media,
    };
  }

  private mapStudio(s: TPDBScene['studio']): AdultStudioInfo | undefined {
    if (!s) return undefined;
    return {
      name: s.name,
      externalId: s.id ?? s.external_id,
      source: AdultMetadataSource.TPDB,
      logoUrl: s.logo_url,
      sceneCount: 0,
    };
  }

  private mapCategories(cats?: { id: string; name: string }[]): ContentCategory[] {
    if (!cats) return [];
    const mapped: ContentCategory[] = [];
    for (const c of cats) {
      const key = (TPDB_CATEGORY_MAP[c.name.toLowerCase()] ?? TPDB_CATEGORY_MAP[c.id]);
      if (key && !mapped.includes(key)) mapped.push(key);
    }
    return mapped;
  }

  public mapScene(s: TPDBScene): AdultSceneResult {
    return {
      source: AdultMetadataSource.TPDB,
      sourceId: s.id,
      title: s.title,
      originalTitle: s.original_title,
      releaseDate: s.release_date,
      runtime: s.runtime,
      description: s.description,
      categories: this.mapCategories(s.categories),
      tags: s.tags?.map((t) => t.name) ?? [],
      posterUrl: s.poster_url,
      backdropUrl: s.backdrop_url,
      trailerUrl: s.trailer_url,
      studio: this.mapStudio(s.studio),
      performers: s.performers?.map((p) => this.mapPerformer(p)) ?? [],
      url: s.url ?? `https://theporndb.net/scene/${s.id}`,
    };
  }

  // --- API Methods ---

  /**
   * Search scenes by query string with optional filters.
   * GET /api/v1/scenes
   */
  async searchScenes(query: string, options?: {
    page?: number;
    pageSize?: number;
    performers?: string;
    studio?: string;
    categories?: string[];
    sort?: string;
  }): Promise<TPDBSearchResponse> {
    try {
      const params: Record<string, string | number> = {
        q: query,
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
      };
      if (options?.performers) params.performers = options.performers;
      if (options?.studio) params.studio = options.studio;
      if (options?.categories?.length) params.categories = options.categories.join(',');
      if (options?.sort) params.sort = options.sort;

      return await this.get<TPDBSearchResponse>('/api/v1/scenes', { params });
    } catch (e) {
      logger.error('ThePornDB scene search failed', {
        label: 'TPDB',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get detailed scene information by ID.
   * GET /api/v1/scenes/:id
   */
  async getScene(id: string): Promise<AdultSceneResult> {
    try {
      const data = await this.get<{ data: TPDBScene }>(`/api/v1/scenes/${id}`);
      return this.mapScene(data.data);
    } catch (e) {
      logger.error('ThePornDB getScene failed', {
        label: 'TPDB',
        errorMessage: e.message,
        sceneId: id,
      });
      throw e;
    }
  }

  /**
   * Search performers by name.
   * GET /api/v1/performers
   */
  async searchPerformers(query: string, options?: {
    page?: number;
    pageSize?: number;
    gender?: string;
  }): Promise<{
    performers: AdultPerformerResult[];
    total: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        q: query,
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
      };
      if (options?.gender) params.gender = options.gender;

      const data = await this.get<TPDBPerformerSearchResponse>('/api/v1/performers', { params });
      return {
        performers: data.data.map((p) => this.mapPerformerFull(p)),
        total: data.meta.total,
        page: data.meta.current_page,
      };
    } catch (e) {
      logger.error('ThePornDB performer search failed', {
        label: 'TPDB',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get detailed performer by ID.
   * GET /api/v1/performers/:id
   */
  async getPerformer(id: string): Promise<AdultPerformerResult> {
    try {
      const data = await this.get<{ data: TPDBPerformer }>(`/api/v1/performers/${id}`);
      return this.mapPerformerFull(data.data);
    } catch (e) {
      logger.error('ThePornDB getPerformer failed', {
        label: 'TPDB',
        errorMessage: e.message,
        performerId: id,
      });
      throw e;
    }
  }

  /**
   * Get scenes for a specific performer.
   * GET /api/v1/performers/:id/scenes
   */
  async getPerformerScenes(performerId: string, options?: {
    page?: number;
    pageSize?: number;
  }): Promise<AdultSceneResult[]> {
    try {
      const params: Record<string, string | number> = {
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 50,
      };
      const data = await this.get<TPDBSearchResponse>(
        `/api/v1/performers/${performerId}/scenes`,
        { params }
      );
      return data.data.map((s) => this.mapScene(s));
    } catch (e) {
      logger.error('ThePornDB getPerformerScenes failed', {
        label: 'TPDB',
        errorMessage: e.message,
        performerId,
      });
      throw e;
    }
  }

  /**
   * Get studio information by ID.
   * GET /api/v1/studios/:id
   */
  async getStudio(id: string): Promise<AdultStudioInfo> {
    try {
      const data = await this.get<{
        data: {
          id: string;
          name: string;
          logo_url?: string;
          description?: string;
          website_url?: string;
          country?: string;
          founded_year?: number;
          scene_count: number;
          url?: string;
        };
      }>(`/api/v1/studios/${id}`);

      return {
        name: data.data.name,
        externalId: data.data.id,
        source: AdultMetadataSource.TPDB,
        logoUrl: data.data.logo_url,
        description: data.data.description,
        websiteUrl: data.data.website_url,
        country: data.data.country,
        foundedYear: data.data.founded_year,
        sceneCount: data.data.scene_count,
        url: data.data.url,
      };
    } catch (e) {
      logger.error('ThePornDB getStudio failed', {
        label: 'TPDB',
        errorMessage: e.message,
        studioId: id,
      });
      throw e;
    }
  }

  /**
   * Get all tags/categories.
   * GET /api/v1/tags
   */
  async getTags(): Promise<{ id: string; name: string; description?: string }[]> {
    try {
      const data = await this.get<{ data: { id: string; name: string; description?: string }[] }>(
        '/api/v1/tags',
        { params: { per_page: 500 } }
      );
      return data.data;
    } catch (e) {
      logger.error('ThePornDB getTags failed', {
        label: 'TPDB',
        errorMessage: e.message,
      });
      throw e;
    }
  }

  /**
   * Get trailer URL for a scene.
   * GET /api/v1/scenes/:id/trailer
   */
  async getTrailer(sceneId: string): Promise<string | undefined> {
    try {
      const data = await this.get<{ data: { url?: string } }>(
        `/api/v1/scenes/${sceneId}/trailer`
      );
      return data.data.url;
    } catch (e) {
      logger.warn('ThePornDB getTrailer failed (non-critical)', {
        label: 'TPDB',
        errorMessage: e.message,
        sceneId,
      });
      return undefined;
    }
  }

  /**
   * Test connection to the API.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.get<{ status: string }>('/api/v1/status');
      return true;
    } catch {
      return false;
    }
  }
}

export default ThePornDB;
