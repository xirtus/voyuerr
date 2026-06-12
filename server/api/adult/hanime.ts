/**
 * Hanime API Client
 *
 * Interfaces with hanime.tv — the largest hentai anime/manga streaming
 * and metadata database. Provides video metadata: titles, tags, brands/studios,
 * series info, and hentai anime episode data.
 *
 * API Base: https://hanime.tv/api/v1
 * (Unofficial but well-documented community endpoints)
 *
 * Phase 8 — Metadata Provider Integration
 */

import ExternalAPI from '@server/api/externalapi';
import { ContentCategory, PerformerGender } from '@server/constants/content';
import logger from '@server/logger';
import { AdultMetadataSource } from './types';
import type {
  AdultPerformerInfo,
  AdultSceneResult,
  AdultStudioInfo,
} from './types';

/** Hanime video object. */
interface HanimeVideo {
  id: number;
  slug: string;
  name: string;
  description?: string;
  poster_url?: string;
  cover_url?: string;
  background_url?: string;
  screenshot_urls?: string[];
  video_url?: string;
  trailer_url?: string;
  released_at_unix?: number;
  duration_in_ms?: number;
  views: number;
  interests: number;
  downloads: number;
  rating?: number;
  brand?: {
    id: number;
    title: string;
    slug: string;
    logo_url?: string;
    website_url?: string;
  };
  series?: {
    id: number;
    title: string;
    slug: string;
  };
  tags?: {
    id: number;
    text: string;
    description?: string;
    type?: string;
  }[];
  franchise_mode?: string;
  is_censored?: boolean;
  is_uncensored?: boolean;
  kind?: string; // 'videos', 'manga'
  language?: string;
  broadcast_at_unix?: number;
}

/** Hanime search response. */
interface HanimeSearchResponse {
  nbPages: number;
  page: number;
  nbHits: number;
  hits: string; // JSON string of hits array
}

/** Hanime video hits (parsed from search response). */
interface HanimeHit {
  id: number;
  slug: string;
  name: string;
  cover_url?: string;
  poster_url?: string;
  views: number;
  interests: number;
  released_at_unix?: number;
  brand?: string;
  tags?: string[];
}

class HanimeAPI extends ExternalAPI {
  static readonly SOURCE = AdultMetadataSource.HANIME;
  static readonly BASE_URL = 'https://search.htv-services.com';

  constructor() {
    super(
      HanimeAPI.BASE_URL,
      {},
      {
        headers: {
          'User-Agent': 'Voyeurr/1.0 (Metadata Scraper)',
        },
        rateLimit: { maxRPS: 2, maxRequests: 30 },
        timeout: 15000,
      }
    );
  }

  // --- Helpers ---

  private mapCategories(tags?: HanimeVideo['tags'], isUncensored?: boolean): ContentCategory[] {
    const cats: ContentCategory[] = [ContentCategory.HENTAI];
    if (isUncensored) cats.push(ContentCategory.UNCENSORED);

    if (tags) {
      const tagNames = tags.map((t) => t.text.toLowerCase());
      if (tagNames.some((t) => t.includes('yaoi') || t.includes('bl'))) cats.push(ContentCategory.GAY);
      if (tagNames.some((t) => t.includes('3d') || t.includes('cg'))) {
        // CG hentai
      }
    }

    return cats;
  }

  private mapVideoToScene(v: HanimeVideo): AdultSceneResult {
    return {
      source: AdultMetadataSource.HANIME,
      sourceId: String(v.id),
      title: v.name,
      description: v.description,
      releaseDate: v.released_at_unix
        ? new Date(v.released_at_unix * 1000).toISOString().split('T')[0]
        : undefined,
      runtime: v.duration_in_ms ? Math.round(v.duration_in_ms / 60000) : undefined,
      categories: this.mapCategories(v.tags, v.is_uncensored),
      tags: v.tags?.map((t) => t.text) ?? [],
      posterUrl: v.poster_url ?? v.cover_url,
      backdropUrl: v.background_url ?? v.screenshot_urls?.[0],
      trailerUrl: v.trailer_url,
      studio: v.brand
        ? {
            name: v.brand.title,
            externalId: String(v.brand.id),
            source: AdultMetadataSource.HANIME,
            logoUrl: v.brand.logo_url,
            websiteUrl: v.brand.website_url,
            sceneCount: 0,
          }
        : undefined,
      performers: [],
      url: `https://hanime.tv/videos/hentai/${v.slug}`,
    };
  }

  // --- API Methods ---

  /**
   * Search hentai videos.
   * GET /api/v2/search
   */
  async searchVideos(query: string, options?: {
    page?: number;
    tags?: string[];
    brand?: string;
    orderBy?: 'released_at_unix' | 'views' | 'interests' | 'rating' | 'title_sortable';
    ordering?: 'asc' | 'desc';
    kind?: string;
  }): Promise<{
    videos: AdultSceneResult[];
    totalPages: number;
    page: number;
    total: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        search_text: query,
        page: options?.page ?? 0,
        order_by: options?.orderBy ?? 'released_at_unix',
        ordering: options?.ordering ?? 'desc',
      };
      if (options?.tags?.length) params.tags = options.tags.join(',');
      if (options?.brand) params.brand = options.brand;
      if (options?.kind) params.kind = options.kind;

      const data = await this.get<HanimeSearchResponse>('/api/v2/search', { params });

      const hits: HanimeHit[] = JSON.parse(data.hits);

      // Map hits to basic scene results (full Rich info requires separate API calls)
      const videos: AdultSceneResult[] = hits.map((hit) => ({
        source: AdultMetadataSource.HANIME,
        sourceId: String(hit.id),
        title: hit.name,
        releaseDate: hit.released_at_unix
          ? new Date(hit.released_at_unix * 1000).toISOString().split('T')[0]
          : undefined,
        categories: [ContentCategory.HENTAI],
        tags: hit.tags ?? [],
        posterUrl: hit.cover_url ?? hit.poster_url,
        studio: hit.brand
          ? { name: hit.brand, source: AdultMetadataSource.HANIME, sceneCount: 0 }
          : undefined,
        performers: [],
        url: `https://hanime.tv/videos/hentai/${hit.slug}`,
      }));

      return {
        videos,
        totalPages: data.nbPages,
        page: data.page,
        total: data.nbHits,
      };
    } catch (e) {
      logger.error('Hanime searchVideos failed', {
        label: 'Hanime',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get full video details by slug.
   * GET /api/v1/video
   */
  async getVideoBySlug(slug: string): Promise<AdultSceneResult> {
    try {
      const data = await this.get<{
        data: { video: HanimeVideo };
      }>(`/api/v1/video?slug=${encodeURIComponent(slug)}`);
      return this.mapVideoToScene(data.data.video);
    } catch (e) {
      logger.error('Hanime getVideoBySlug failed', {
        label: 'Hanime',
        errorMessage: e.message,
        slug,
      });
      throw e;
    }
  }

  /**
   * Get video by ID.
   * GET /api/v1/video
   */
  async getVideo(id: number): Promise<AdultSceneResult> {
    try {
      const data = await this.get<{
        data: { video: HanimeVideo };
      }>(`/api/v1/video?id=${id}`);
      return this.mapVideoToScene(data.data.video);
    } catch (e) {
      logger.error('Hanime getVideo failed', {
        label: 'Hanime',
        errorMessage: e.message,
        videoId: id,
      });
      throw e;
    }
  }

  /**
   * Get videos by brand ID.
   * GET /api/v2/search with brand filter
   */
  async getBrandVideos(brandId: number, options?: {
    page?: number;
    orderBy?: string;
  }): Promise<{
    videos: AdultSceneResult[];
    totalPages: number;
    page: number;
  }> {
    // Search empty query with brand filter
    return this.searchVideos('', {
      ...options,
      brand: String(brandId),
    });
  }

  /**
   * Get all tags/categories.
   * GET /api/v2/tags
   */
  async getTags(): Promise<{ id: number; text: string; description?: string; count: number }[]> {
    try {
      return await this.get<{ id: number; text: string; description?: string; count: number }[]>(
        '/api/v2/tags'
      );
    } catch (e) {
      logger.error('Hanime getTags failed', {
        label: 'Hanime',
        errorMessage: e.message,
      });
      throw e;
    }
  }

  /**
   * Get trending/popular videos.
   * GET /api/v2/search with popular ordering
   */
  async getTrending(page = 0): Promise<{
    videos: AdultSceneResult[];
    totalPages: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        order_by: 'views',
        ordering: 'desc',
        page,
      };
      const data = await this.get<HanimeSearchResponse>('/api/v2/search', { params });
      const hits: HanimeHit[] = JSON.parse(data.hits);

      return {
        videos: hits.map((hit) => ({
          source: AdultMetadataSource.HANIME,
          sourceId: String(hit.id),
          title: hit.name,
          releaseDate: hit.released_at_unix
            ? new Date(hit.released_at_unix * 1000).toISOString().split('T')[0]
            : undefined,
          categories: [ContentCategory.HENTAI],
          tags: hit.tags ?? [],
          posterUrl: hit.cover_url ?? hit.poster_url,
          performers: [],
          url: `https://hanime.tv/videos/hentai/${hit.slug}`,
        })),
        totalPages: data.nbPages,
        page: data.page,
      };
    } catch (e) {
      logger.error('Hanime getTrending failed', {
        label: 'Hanime',
        errorMessage: e.message,
      });
      throw e;
    }
  }

  /**
   * Test API connection.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.get<HanimeSearchResponse>('/api/v2/search', {
        params: { search_text: '', page: 0 },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export default HanimeAPI;
