/**
 * Fakku API Client
 *
 * Interfaces with fakku.net — licensed English hentai manga publisher.
 * Provides metadata for professionally translated hentai manga:
 * titles, artists, tags, series, and high-quality cover artwork.
 *
 * API Base: https://api.fakku.net/v1
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

/** Fakku manga/book object. */
interface FakkuBook {
  id: string;
  content_id?: string;
  title: string;
  description?: string;
  volume?: number;
  release_date?: string;
  pages: number;
  cover_url?: string;
  thumbnail_url?: string;
  images?: string[];
  artists?: { id: string; name: string; slug?: string }[];
  tags?: { id: string; name: string; category?: string }[];
  series?: {
    id: string;
    name: string;
    slug?: string;
  }[];
  publisher?: {
    id: string;
    name: string;
  };
  language?: string;
  rating?: number;
  favorites: number;
  url?: string;
  is_adult?: boolean;
}

/** Fakku search response. */
interface FakkuSearchResponse {
  data: FakkuBook[];
  total: number;
  page: number;
  per_page: number;
}

/** Map Fakku tag to categories. */
const FAKKU_CATEGORY_MAP: Record<string, ContentCategory> = {
  'yaoi': ContentCategory.GAY,
  'yuri': ContentCategory.QUEER,
  'lolicon': ContentCategory.HENTAI,
  'shotacon': ContentCategory.HENTAI,
  'futanari': ContentCategory.TRANS,
  'gender bender': ContentCategory.TRANS,
  'uncensored': ContentCategory.UNCENSORED,
};

class FakkuAPI extends ExternalAPI {
  static readonly SOURCE = AdultMetadataSource.FAKKU;
  static readonly BASE_URL = 'https://api.fakku.net/v1';

  constructor() {
    super(
      FakkuAPI.BASE_URL,
      {},
      {
        headers: {
          'User-Agent': 'Voyeurr/1.0',
          Accept: 'application/json',
        },
        rateLimit: { maxRPS: 2, maxRequests: 30 },
        timeout: 15000,
      }
    );
  }

  // --- Helpers ---

  private mapCategories(tags?: FakkuBook['tags']): ContentCategory[] {
    const cats: ContentCategory[] = [ContentCategory.HENTAI];
    if (tags) {
      for (const t of tags) {
        const key = FAKKU_CATEGORY_MAP[t.name.toLowerCase()];
        if (key && !cats.includes(key)) cats.push(key);
      }
    }
    return cats;
  }

  private mapBookToScene(b: FakkuBook): AdultSceneResult {
    return {
      source: AdultMetadataSource.FAKKU,
      sourceId: b.id,
      title: b.title,
      description: b.description,
      releaseDate: b.release_date,
      categories: this.mapCategories(b.tags),
      tags: b.tags?.map((t) => t.name) ?? [],
      posterUrl: b.cover_url,
      backdropUrl: undefined,
      studio: b.publisher
        ? {
            name: b.publisher.name,
            externalId: b.publisher.id,
            source: AdultMetadataSource.FAKKU,
            sceneCount: 0,
          }
        : undefined,
      performers: b.artists?.map((a) => ({
        name: a.name,
        source: AdultMetadataSource.FAKKU,
        gender: PerformerGender.FEMALE,
      })) ?? [],
      url: b.url ?? `https://www.fakku.net/hentai/${b.content_id ?? b.id}`,
    };
  }

  // --- API Methods ---

  /**
   * Search manga by title, artist, or tag.
   * GET /v1/search
   */
  async searchManga(query: string, options?: {
    page?: number;
    pageSize?: number;
    sort?: 'relevance' | 'newest' | 'popular' | 'rating';
    tags?: string[];
    artists?: string[];
    series?: string;
  }): Promise<{
    manga: AdultSceneResult[];
    total: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        q: query,
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
      };
      if (options?.sort) params.sort = options.sort;
      if (options?.tags?.length) params.tags = options.tags.join(',');
      if (options?.artists?.length) params.artists = options.artists.join(',');
      if (options?.series) params.series = options.series;

      const data = await this.get<FakkuSearchResponse>('/search', { params });

      return {
        manga: data.data.map((b) => this.mapBookToScene(b)),
        total: data.total,
        page: data.page,
      };
    } catch (e) {
      logger.error('Fakku searchManga failed', {
        label: 'Fakku',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get book details by ID or content_id.
   * GET /v1/books/:id
   */
  async getBook(id: string): Promise<AdultSceneResult> {
    try {
      const data = await this.get<{ data: FakkuBook }>(`/books/${id}`);
      return this.mapBookToScene(data.data);
    } catch (e) {
      logger.error('Fakku getBook failed', {
        label: 'Fakku',
        errorMessage: e.message,
        bookId: id,
      });
      throw e;
    }
  }

  /**
   * Get books by artist.
   * GET /v1/artists/:id/books
   */
  async getArtistBooks(artistId: string, options?: {
    page?: number;
    pageSize?: number;
  }): Promise<AdultSceneResult[]> {
    try {
      const params: Record<string, string | number> = {
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
      };
      const data = await this.get<FakkuSearchResponse>(
        `/artists/${artistId}/books`,
        { params }
      );
      return data.data.map((b) => this.mapBookToScene(b));
    } catch (e) {
      logger.error('Fakku getArtistBooks failed', {
        label: 'Fakku',
        errorMessage: e.message,
        artistId,
      });
      throw e;
    }
  }

  /**
   * Get artist details.
   * GET /v1/artists/:id
   */
  async getArtist(artistId: string): Promise<{
    id: string;
    name: string;
    bio?: string;
    image_url?: string;
    book_count: number;
  }> {
    try {
      const data = await this.get<{
        data: {
          id: string;
          name: string;
          bio?: string;
          image_url?: string;
          book_count: number;
        };
      }>(`/artists/${artistId}`);
      return data.data;
    } catch (e) {
      logger.error('Fakku getArtist failed', {
        label: 'Fakku',
        errorMessage: e.message,
        artistId,
      });
      throw e;
    }
  }

  /**
   * Get all tags.
   * GET /v1/tags
   */
  async getTags(): Promise<{ id: string; name: string; category?: string; count: number }[]> {
    try {
      return await this.get<{ id: string; name: string; category?: string; count: number }[]>(
        '/tags'
      );
    } catch (e) {
      logger.error('Fakku getTags failed', {
        label: 'Fakku',
        errorMessage: e.message,
      });
      throw e;
    }
  }

  /**
   * Get new releases.
   * GET /v1/books/latest
   */
  async getLatestReleases(page = 1, pageSize = 25): Promise<{
    manga: AdultSceneResult[];
    total: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = { page, per_page: pageSize };
      const data = await this.get<FakkuSearchResponse>('/books/latest', { params });
      return {
        manga: data.data.map((b) => this.mapBookToScene(b)),
        total: data.total,
        page: data.page,
      };
    } catch (e) {
      logger.error('Fakku getLatestReleases failed', {
        label: 'Fakku',
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
      await this.get<{ status: string }>('/status');
      return true;
    } catch {
      return false;
    }
  }
}

export default FakkuAPI;
