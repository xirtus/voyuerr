/**
 * R18.dev / JavDB API Client
 *
 * JAV-specific metadata provider. Handles Japanese Adult Video content
 * with studio codes, actress kanji/romaji names, and release information.
 *
 * R18.dev provides a REST API wrapper around JavDB and related JAV databases.
 * Base: https://r18.dev (community-maintained)
 * JavDB: https://javdb.com (requires scraping/API access)
 *
 * Phase 8 — Metadata Provider Integration
 */

import ExternalAPI from '@server/api/externalapi';
import { ContentCategory, PerformerGender } from '@server/constants/content';
import logger from '@server/logger';
import { AdultMetadataSource } from './types';
import type {
  AdultPerformerInfo,
  AdultPerformerResult,
  AdultSceneResult,
  AdultStudioInfo,
} from './types';

/** R18.dev scene object. */
interface R18Scene {
  id: string;
  code: string; // Studio code (e.g., "SSIS-001", "ABP-999")
  title: string;
  title_jp?: string; // Japanese title
  release_date?: string;
  runtime?: number;
  description?: string;
  description_jp?: string;
  cover_url?: string;
  thumb_url?: string;
  screenshots?: string[];
  preview_url?: string;
  studio?: {
    id: string;
    name: string;
    name_jp?: string;
    logo_url?: string;
  };
  label?: {
    id: string;
    name: string;
  };
  series?: {
    id: string;
    name: string;
  };
  director?: {
    id: string;
    name: string;
  };
  actresses?: R18Actress[];
  genres?: { id: string; name: string }[];
  tags?: { id: string; name: string }[];
  uncensored?: boolean;
  mosaic?: boolean;
  rating?: number;
  url?: string;
}

/** R18.dev actress object. */
interface R18Actress {
  id: string;
  name: string; // Romaji
  name_jp?: string; // Kanji/kana
  aliases?: string[];
  birth_date?: string;
  height?: number;
  bust?: string;
  waist?: string;
  hips?: string;
  cup_size?: string;
  blood_type?: string;
  hobby?: string;
  image_url?: string;
  thumb_url?: string;
  active?: boolean;
  scene_count?: number;
  debut_date?: string;
  social_media?: {
    twitter?: string;
    instagram?: string;
  };
}

/** R18 search response. */
interface R18SearchResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_results: number;
    per_page: number;
  };
}

/** Map JAV genre names to internal categories. */
const R18_CATEGORY_MAP: Record<string, ContentCategory> = {
  'jav': ContentCategory.JAV,
  'japanese': ContentCategory.JAV,
  'uncensored': ContentCategory.UNCENSORED,
  'censored': ContentCategory.JAV,
  'vr': ContentCategory.VR,
  '4k': ContentCategory.UHD,
  'amateur': ContentCategory.AMATEUR,
  'hentai': ContentCategory.HENTAI,
  'anime': ContentCategory.HENTAI,
  'gay': ContentCategory.GAY,
  'transgender': ContentCategory.TRANS,
  'trans': ContentCategory.TRANS,
  'leaked': ContentCategory.LEAKED,
};

class R18API extends ExternalAPI {
  static readonly SOURCE = AdultMetadataSource.R18;
  static readonly BASE_URL = 'https://r18.dev/api/v1';

  constructor(apiKey?: string) {
    super(
      R18API.BASE_URL,
      {},
      {
        headers: {
          'X-API-Key': apiKey ?? '',
          Accept: 'application/json',
        },
        rateLimit: { maxRPS: 3, maxRequests: 60 },
        timeout: 15000,
      }
    );
  }

  // --- Helpers ---

  private mapActress(a: R18Actress): AdultPerformerInfo {
    return {
      name: a.name,
      externalId: a.id,
      source: AdultMetadataSource.R18,
      imageUrl: a.image_url ?? a.thumb_url,
      gender: PerformerGender.FEMALE,
    };
  }

  private mapActressFull(a: R18Actress): AdultPerformerResult {
    const measurements = [a.bust, a.waist, a.hips].filter(Boolean).join('-');
    return {
      source: AdultMetadataSource.R18,
      sourceId: a.id,
      name: a.name,
      aliases: a.aliases ?? (a.name_jp ? [a.name_jp] : []),
      birthDate: a.birth_date,
      gender: PerformerGender.FEMALE,
      imageUrl: a.image_url,
      thumbnailUrl: a.thumb_url,
      height: a.height,
      measurements: measurements || undefined,
      sceneCount: a.scene_count ?? 0,
      active: a.active ?? true,
      popularity: 0,
      socialMedia: {
        ...(a.social_media?.twitter && { twitter: a.social_media.twitter }),
        ...(a.social_media?.instagram && { instagram: a.social_media.instagram }),
      },
    };
  }

  private mapCategories(genres?: { name: string }[], uncensored?: boolean): ContentCategory[] {
    const cats: ContentCategory[] = [ContentCategory.JAV];
    if (uncensored) cats.push(ContentCategory.UNCENSORED);
    if (genres) {
      for (const g of genres) {
        const mapped = R18_CATEGORY_MAP[g.name.toLowerCase()];
        if (mapped && !cats.includes(mapped)) cats.push(mapped);
      }
    }
    return cats;
  }

  private mapScene(s: R18Scene): AdultSceneResult {
    return {
      source: AdultMetadataSource.R18,
      sourceId: s.id,
      title: s.title,
      originalTitle: s.title_jp,
      releaseDate: s.release_date,
      runtime: s.runtime,
      description: s.description,
      categories: this.mapCategories(s.genres, s.uncensored),
      tags: [
        ...(s.genres?.map((g) => g.name) ?? []),
        ...(s.tags?.map((t) => t.name) ?? []),
        s.code,
        ...(s.mosaic === false ? ['uncensored'] : []),
        ...(s.mosaic ? ['censored'] : []),
      ],
      posterUrl: s.cover_url,
      backdropUrl: s.screenshots?.[0],
      trailerUrl: s.preview_url,
      studio: s.studio
        ? {
            name: s.studio.name,
            externalId: s.studio.id,
            source: AdultMetadataSource.R18,
            logoUrl: s.studio.logo_url,
            sceneCount: 0,
          }
        : undefined,
      performers: s.actresses?.map((a) => this.mapActress(a)) ?? [],
      url: s.url ?? `https://r18.dev/movies/${s.code}`,
    };
  }

  // --- API Methods ---

  /**
   * Search scenes by JAV code or title.
   * GET /api/v1/movies/search
   */
  async searchScenes(query: string, options?: {
    page?: number;
    pageSize?: number;
    actress?: string;
    studio?: string;
    genre?: string;
    uncensored?: boolean;
  }): Promise<{ scenes: AdultSceneResult[]; total: number; page: number; pages: number }> {
    try {
      const params: Record<string, string | number | boolean> = {
        q: query,
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 30,
      };
      if (options?.actress) params.actress = options.actress;
      if (options?.studio) params.studio = options.studio;
      if (options?.genre) params.genre = options.genre;
      if (options?.uncensored !== undefined) params.uncensored = options.uncensored;

      const data = await this.get<R18SearchResponse<R18Scene>>('/movies/search', { params });
      return {
        scenes: data.data.map((s) => this.mapScene(s)),
        total: data.pagination.total_results,
        page: data.pagination.current_page,
        pages: data.pagination.total_pages,
      };
    } catch (e) {
      logger.error('R18 scene search failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get scene by JAV code (e.g., "SSIS-001").
   * GET /api/v1/movies/:code
   */
  async getSceneByCode(code: string): Promise<AdultSceneResult> {
    try {
      const data = await this.get<{ data: R18Scene }>(`/movies/${encodeURIComponent(code)}`);
      return this.mapScene(data.data);
    } catch (e) {
      logger.error('R18 getSceneByCode failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        code,
      });
      throw e;
    }
  }

  /**
   * Get scene by R18 ID.
   * GET /api/v1/movies/id/:id
   */
  async getScene(id: string): Promise<AdultSceneResult> {
    try {
      const data = await this.get<{ data: R18Scene }>(`/movies/id/${id}`);
      return this.mapScene(data.data);
    } catch (e) {
      logger.error('R18 getScene failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        sceneId: id,
      });
      throw e;
    }
  }

  /**
   * Search actresses by name.
   * GET /api/v1/actresses/search
   */
  async searchActresses(query: string, options?: {
    page?: number;
    pageSize?: number;
  }): Promise<{
    actresses: AdultPerformerResult[];
    total: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        q: query,
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
      };

      const data = await this.get<R18SearchResponse<R18Actress>>('/actresses/search', { params });
      return {
        actresses: data.data.map((a) => this.mapActressFull(a)),
        total: data.pagination.total_results,
        page: data.pagination.current_page,
      };
    } catch (e) {
      logger.error('R18 actress search failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get actress by ID.
   * GET /api/v1/actresses/:id
   */
  async getActress(id: string): Promise<AdultPerformerResult> {
    try {
      const data = await this.get<{ data: R18Actress }>(`/actresses/${id}`);
      return this.mapActressFull(data.data);
    } catch (e) {
      logger.error('R18 getActress failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        actressId: id,
      });
      throw e;
    }
  }

  /**
   * Get scenes for an actress.
   * GET /api/v1/actresses/:id/movies
   */
  async getActressScenes(actressId: string, options?: {
    page?: number;
    pageSize?: number;
  }): Promise<AdultSceneResult[]> {
    try {
      const params: Record<string, string | number> = {
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 50,
      };
      const data = await this.get<R18SearchResponse<R18Scene>>(
        `/actresses/${actressId}/movies`,
        { params }
      );
      return data.data.map((s) => this.mapScene(s));
    } catch (e) {
      logger.error('R18 getActressScenes failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        actressId,
      });
      throw e;
    }
  }

  /**
   * Get studio by ID.
   * GET /api/v1/studios/:id
   */
  async getStudio(id: string): Promise<AdultStudioInfo> {
    try {
      const data = await this.get<{
        data: {
          id: string;
          name: string;
          name_jp?: string;
          logo_url?: string;
          description?: string;
          website_url?: string;
          scene_count: number;
        };
      }>(`/studios/${id}`);

      return {
        name: data.data.name,
        externalId: data.data.id,
        source: AdultMetadataSource.R18,
        logoUrl: data.data.logo_url,
        description: data.data.description,
        websiteUrl: data.data.website_url,
        sceneCount: data.data.scene_count,
      };
    } catch (e) {
      logger.error('R18 getStudio failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        studioId: id,
      });
      throw e;
    }
  }

  /**
   * Search studios by name.
   * GET /api/v1/studios/search
   */
  async searchStudios(query: string, options?: {
    page?: number;
    pageSize?: number;
  }): Promise<{
    studios: AdultStudioInfo[];
    total: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        q: query,
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
      };
      const data = await this.get<{
        data: {
          id: string;
          name: string;
          logo_url?: string;
          scene_count: number;
        }[];
        pagination: { current_page: number; total_results: number };
      }>('/studios/search', { params });

      return {
        studios: data.data.map((s) => ({
          name: s.name,
          externalId: s.id,
          source: AdultMetadataSource.R18,
          logoUrl: s.logo_url,
          sceneCount: s.scene_count,
        })),
        total: data.pagination.total_results,
        page: data.pagination.current_page,
      };
    } catch (e) {
      logger.error('R18 studio search failed', {
        label: 'R18.dev',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Test API connection.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.get<{ status: string }>('/status');
      return true;
    } catch {
      return false;
    }
  }
}

export default R18API;
