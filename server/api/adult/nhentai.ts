/**
 * nHentai API Client
 *
 * Interfaces with nhentai.net — the largest hentai manga/doujinshi database.
 * Provides manga metadata: titles (multi-language), tags, artists, parodies,
 * characters, and cover artwork.
 *
 * nHentai has a documented REST API at https://nhentai.net/api/
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

/** nHentai gallery object. */
interface NHentaiGallery {
  id: number;
  media_id: string;
  title: {
    english?: string;
    japanese?: string;
    pretty?: string;
  };
  images: {
    pages: { t: string; w: number; h: number }[];
    cover: { t: string; w: number; h: number };
    thumbnail: { t: string; w: number; h: number };
  };
  scanlator?: string;
  upload_date?: number; // Unix timestamp
  tags: { id: number; type: string; name: string; url?: string }[];
  num_pages: number;
  num_favorites: number;
}

/** nHentai search response. */
interface NHentaiSearchResponse {
  result: NHentaiGallery[];
  num_pages: number;
  per_page: number;
}

/** Tag type mapping to artist/performer role. */
const ARTIST_TAG_TYPES = ['artist', 'group'];

/** Build nHentai image URL from media_id and image type. */
function nhImageUrl(mediaId: string, type: 'cover' | 'thumb' | 'page', ext = 'jpg', pageNum = 1): string {
  if (type === 'page') {
    return `https://i.nhentai.net/galleries/${mediaId}/${pageNum}.${ext}`;
  }
  return `https://t.nhentai.net/galleries/${mediaId}/${type}.${ext}`;
}

class NHentai extends ExternalAPI {
  static readonly SOURCE = AdultMetadataSource.NHENTAI;
  static readonly BASE_URL = 'https://nhentai.net/api';

  constructor() {
    super(
      NHentai.BASE_URL,
      {},
      {
        rateLimit: { maxRPS: 3, maxRequests: 60 },
        timeout: 15000,
      }
    );
  }

  // --- Helpers ---

  private mapTagsToCategories(tags: NHentaiGallery['tags']): ContentCategory[] {
    const cats: ContentCategory[] = [ContentCategory.HENTAI];
    const tagNames = tags.map((t) => t.name.toLowerCase());

    // Map common nHentai tags to categories
    if (tagNames.some((t) => ['full color', 'full censorship'].includes(t) || t.includes('uncensored'))) {
      cats.push(ContentCategory.UNCENSORED);
    }
    if (tagNames.some((t) => ['yaoi', 'males only', 'male'].includes(t))) cats.push(ContentCategory.GAY);
    if (tagNames.some((t) => t.includes('lolicon') || t.includes('shotacon'))) {
      // Still hentai but marked
    }

    return cats;
  }

  private mapGalleryToScene(g: NHentaiGallery): AdultSceneResult {
    const artistTags = g.tags.filter((t) => ARTIST_TAG_TYPES.includes(t.type));
    const contentTags = g.tags
      .filter((t) => !ARTIST_TAG_TYPES.includes(t.type))
      .map((t) => t.name);

    return {
      source: AdultMetadataSource.NHENTAI,
      sourceId: String(g.id),
      title: g.title.english ?? g.title.pretty ?? `#${g.id}`,
      originalTitle: g.title.japanese,
      releaseDate: g.upload_date
        ? new Date(g.upload_date * 1000).toISOString().split('T')[0]
        : undefined,
      categories: this.mapTagsToCategories(g.tags),
      tags: contentTags,
      posterUrl: nhImageUrl(g.media_id, 'cover'),
      backdropUrl: g.images.pages[0]
        ? nhImageUrl(g.media_id, 'page', 'jpg', 1)
        : undefined,
      studio: g.scanlator
        ? {
            name: g.scanlator,
            source: AdultMetadataSource.NHENTAI,
            sceneCount: 0,
          }
        : undefined,
      performers: artistTags.map((t) => ({
        name: t.name,
        source: AdultMetadataSource.NHENTAI,
        gender: PerformerGender.FEMALE,
      })),
      url: `https://nhentai.net/g/${g.id}/`,
    };
  }

  // --- API Methods ---

  /**
   * Search galleries by query string.
   * GET /api/galleries/search?query=...
   */
  async searchGalleries(query: string, options?: {
    page?: number;
    sort?: 'date' | 'popular' | 'popular-week' | 'popular-today';
  }): Promise<{
    galleries: AdultSceneResult[];
    totalPages: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        query,
        page: options?.page ?? 1,
        sort: options?.sort ?? 'date',
      };

      const data = await this.get<NHentaiSearchResponse>('/galleries/search', { params });

      return {
        galleries: data.result.map((g) => this.mapGalleryToScene(g)),
        totalPages: data.num_pages,
        page: options?.page ?? 1,
      };
    } catch (e) {
      logger.error('nHentai searchGalleries failed', {
        label: 'nHentai',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get gallery by numeric ID (the "magic number").
   * GET /api/gallery/:id
   */
  async getGallery(id: number | string): Promise<AdultSceneResult> {
    try {
      const data = await this.get<NHentaiGallery>(`/gallery/${id}`);
      return this.mapGalleryToScene(data);
    } catch (e) {
      logger.error('nHentai getGallery failed', {
        label: 'nHentai',
        errorMessage: e.message,
        galleryId: id,
      });
      throw e;
    }
  }

  /**
   * Get related galleries (based on shared tags/artist).
   * GET /api/gallery/:id/related
   */
  async getRelated(id: number | string): Promise<AdultSceneResult[]> {
    try {
      const data = await this.get<{ result: NHentaiGallery[] }>(`/gallery/${id}/related`);
      return data.result.map((g) => this.mapGalleryToScene(g));
    } catch (e) {
      logger.error('nHentai getRelated failed', {
        label: 'nHentai',
        errorMessage: e.message,
        galleryId: id,
      });
      throw e;
    }
  }

  /**
   * Search by tag ID.
   * GET /api/galleries/tagged?tag_id=...
   */
  async searchByTag(tagId: number, options?: {
    page?: number;
    sort?: 'date' | 'popular';
  }): Promise<{
    galleries: AdultSceneResult[];
    totalPages: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        tag_id: tagId,
        page: options?.page ?? 1,
        sort: options?.sort ?? 'date',
      };
      const data = await this.get<NHentaiSearchResponse>('/galleries/tagged', { params });
      return {
        galleries: data.result.map((g) => this.mapGalleryToScene(g)),
        totalPages: data.num_pages,
        page: options?.page ?? 1,
      };
    } catch (e) {
      logger.error('nHentai searchByTag failed', {
        label: 'nHentai',
        errorMessage: e.message,
        tagId,
      });
      throw e;
    }
  }

  /**
   * Search by artist name or tag name (using nHentai auto-complete style).
   * GET /api/galleries/search?query=artist:"name"
   */
  async searchByArtist(artistName: string, options?: {
    page?: number;
  }): Promise<{
    galleries: AdultSceneResult[];
    totalPages: number;
    page: number;
  }> {
    return this.searchGalleries(`artist:"${artistName}"`, options);
  }

  /**
   * Get all tags metadata.
   * GET /api/tags
   */
  async getTags(): Promise<{ id: number; type: string; name: string; count: number }[]> {
    try {
      return await this.get<{ id: number; type: string; name: string; count: number }[]>('/tags');
    } catch (e) {
      logger.error('nHentai getTags failed', {
        label: 'nHentai',
        errorMessage: e.message,
      });
      throw e;
    }
  }

  /**
   * Browse homepage / popular.
   * GET /api/galleries/all
   */
  async getPopular(page = 1): Promise<{
    galleries: AdultSceneResult[];
    totalPages: number;
    page: number;
  }> {
    try {
      const data = await this.get<NHentaiSearchResponse>('/galleries/all', {
        params: { page },
      });
      return {
        galleries: data.result.map((g) => this.mapGalleryToScene(g)),
        totalPages: data.num_pages,
        page,
      };
    } catch (e) {
      logger.error('nHentai getPopular failed', {
        label: 'nHentai',
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
      await this.get<NHentaiGallery>('/gallery/1');
      return true;
    } catch {
      return false;
    }
  }
}

export default NHentai;
