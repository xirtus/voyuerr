/**
 * AdultDVDEmpire Metadata Provider
 *
 * Provides DVD/VOD metadata: covers, cast, synopsis, release dates.
 * Scrapes or queries AdultDVDEmpire.com for Western adult content metadata.
 *
 * AdultDVDEmpire has been the largest adult DVD/VOD retailer with extensive
 * catalog metadata including studio info, performer details, and reviews.
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

/** AdultDVDEmpire DVD/VOD item. */
interface ADEScene {
  id: string;
  title: string;
  description?: string;
  release_date?: string;
  runtime?: number;
  studio?: string;
  studio_id?: string;
  performers?: string[];
  categories?: string[];
  box_cover_url?: string;
  back_cover_url?: string;
  screenshots?: string[];
  trailer_url?: string;
  url?: string;
  rating?: number;
  sku?: string;
  format?: string; // DVD, Blu-ray, VOD
  upc?: string;
  director?: string;
}

/** Category mapping. */
const ADE_CATEGORY_MAP: Record<string, ContentCategory> = {
  'amateur': ContentCategory.AMATEUR,
  'anal': ContentCategory.WESTERN,
  'asian': ContentCategory.JAV,
  'bbw': ContentCategory.WESTERN,
  'big': ContentCategory.WESTERN,
  'bisexual': ContentCategory.QUEER,
  'blonde': ContentCategory.WESTERN,
  'blowjob': ContentCategory.WESTERN,
  'compilation': ContentCategory.COMPILATION,
  'creampie': ContentCategory.WESTERN,
  'dp': ContentCategory.WESTERN,
  'ebony': ContentCategory.WESTERN,
  'fetish': ContentCategory.WESTERN,
  'gay': ContentCategory.GAY,
  'gonzo': ContentCategory.WESTERN,
  'group': ContentCategory.WESTERN,
  'hd': ContentCategory.WESTERN,
  'hentai': ContentCategory.HENTAI,
  'interracial': ContentCategory.QUEER,
  'latin': ContentCategory.WESTERN,
  'lesbian': ContentCategory.QUEER,
  'masturbation': ContentCategory.WESTERN,
  'milf': ContentCategory.WESTERN,
  'oral': ContentCategory.WESTERN,
  'parody': ContentCategory.WESTERN,
  'pov': ContentCategory.WESTERN,
  'romance': ContentCategory.WESTERN,
  'shemale': ContentCategory.TRANS,
  'solo': ContentCategory.WESTERN,
  'squirt': ContentCategory.WESTERN,
  'teens': ContentCategory.WESTERN,
  'threesome': ContentCategory.WESTERN,
  'trans': ContentCategory.TRANS,
  'transgender': ContentCategory.TRANS,
  'vr': ContentCategory.VR,
  'vignettes': ContentCategory.WESTERN,
  'vintage': ContentCategory.WESTERN,
};

class AdultDVDEmpireAPI extends ExternalAPI {
  static readonly SOURCE = AdultMetadataSource.ADULT_DVD_EMPIRE;
  static readonly BASE_URL = 'https://api.adultdvdempire.com/v1';

  constructor(apiKey?: string) {
    super(
      AdultDVDEmpireAPI.BASE_URL,
      {},
      {
        headers: {
          'X-API-Key': apiKey ?? '',
        },
        rateLimit: { maxRPS: 1, maxRequests: 20 },
        timeout: 15000,
      }
    );
  }

  // --- Helpers ---

  private mapCategories(cats?: string[]): ContentCategory[] {
    if (!cats) return [ContentCategory.WESTERN];
    const mapped: ContentCategory[] = [];
    for (const c of cats) {
      const key = ADE_CATEGORY_MAP[c.toLowerCase().trim()];
      if (key && !mapped.includes(key)) mapped.push(key);
    }
    if (!mapped.length) mapped.push(ContentCategory.WESTERN);
    return mapped;
  }

  private mapScene(s: ADEScene): AdultSceneResult {
    return {
      source: AdultMetadataSource.ADULT_DVD_EMPIRE,
      sourceId: s.id,
      title: s.title,
      releaseDate: s.release_date,
      runtime: s.runtime,
      description: s.description,
      categories: this.mapCategories(s.categories),
      tags: [
        ...(s.categories ?? []),
        ...(s.format ? [s.format.toLowerCase()] : []),
        ...(s.director ? [`directed by: ${s.director}`] : []),
      ],
      posterUrl: s.box_cover_url,
      backdropUrl: s.back_cover_url ?? s.screenshots?.[0],
      trailerUrl: s.trailer_url,
      studio: s.studio
        ? {
            name: s.studio,
            externalId: s.studio_id,
            source: AdultMetadataSource.ADULT_DVD_EMPIRE,
            sceneCount: 0,
          }
        : undefined,
      performers: s.performers?.map((name) => ({
        name,
        source: AdultMetadataSource.ADULT_DVD_EMPIRE,
        gender: PerformerGender.FEMALE,
      })) ?? [],
      url: s.url ?? `https://www.adultdvdempire.com/${s.id}/item.html`,
    };
  }

  // --- API Methods ---

  /**
   * Search scenes by title, performer, or studio.
   * GET /v1/dvds/search
   */
  async searchScenes(query: string, options?: {
    page?: number;
    pageSize?: number;
    performer?: string;
    studio?: string;
    category?: string;
    format?: string;
    sort?: 'relevance' | 'newest' | 'oldest' | 'rating' | 'price';
  }): Promise<{
    scenes: AdultSceneResult[];
    total: number;
    page: number;
  }> {
    try {
      const params: Record<string, string | number> = {
        q: query,
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
      };
      if (options?.performer) params.performer = options.performer;
      if (options?.studio) params.studio = options.studio;
      if (options?.category) params.category = options.category;
      if (options?.format) params.format = options.format;
      if (options?.sort) params.sort = options.sort;

      const data = await this.get<{
        data: ADEScene[];
        meta: { total: number; page: number };
      }>('/dvds/search', { params });

      return {
        scenes: data.data.map((s) => this.mapScene(s)),
        total: data.meta.total,
        page: data.meta.page,
      };
    } catch (e) {
      logger.error('AdultDVDEmpire searchScenes failed', {
        label: 'AdultDVDEmpire',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get DVD/VOD details by ID.
   * GET /v1/dvds/:id
   */
  async getScene(id: string): Promise<AdultSceneResult> {
    try {
      const data = await this.get<{ data: ADEScene }>(`/dvds/${id}`);
      return this.mapScene(data.data);
    } catch (e) {
      logger.error('AdultDVDEmpire getScene failed', {
        label: 'AdultDVDEmpire',
        errorMessage: e.message,
        sceneId: id,
      });
      throw e;
    }
  }

  /**
   * Search performers by name.
   * GET /v1/performers/search
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

      const data = await this.get<{
        data: {
          id: string;
          name: string;
          aliases?: string[];
          bio?: string;
          birth_date?: string;
          image_url?: string;
          thumb_url?: string;
          country?: string;
          height?: number;
          weight?: number;
          measurements?: string;
          scene_count: number;
          active: boolean;
          gender?: string;
          url?: string;
        }[];
        meta: { total: number; page: number };
      }>('/performers/search', { params });

      return {
        performers: data.data.map((p) => ({
          source: AdultMetadataSource.ADULT_DVD_EMPIRE,
          sourceId: p.id,
          name: p.name,
          aliases: p.aliases ?? [],
          birthDate: p.birth_date,
          bio: p.bio,
          gender: p.gender === 'Male'
            ? PerformerGender.MALE
            : p.gender === 'Transgender'
              ? PerformerGender.TRANSGENDER
              : PerformerGender.FEMALE,
          imageUrl: p.image_url,
          thumbnailUrl: p.thumb_url,
          country: p.country,
          height: p.height,
          weight: p.weight,
          measurements: p.measurements,
          sceneCount: p.scene_count,
          active: p.active,
          popularity: 0,
          url: p.url,
        })),
        total: data.meta.total,
        page: data.meta.page,
      };
    } catch (e) {
      logger.error('AdultDVDEmpire searchPerformers failed', {
        label: 'AdultDVDEmpire',
        errorMessage: e.message,
        query,
      });
      throw e;
    }
  }

  /**
   * Get performer details by ID.
   * GET /v1/performers/:id
   */
  async getPerformer(id: string): Promise<AdultPerformerResult> {
    try {
      const data = await this.get<{
        data: {
          id: string;
          name: string;
          aliases?: string[];
          bio?: string;
          birth_date?: string;
          image_url?: string;
          thumb_url?: string;
          country?: string;
          height?: number;
          weight?: number;
          measurements?: string;
          scene_count: number;
          active: boolean;
          gender?: string;
          url?: string;
        };
      }>(`/performers/${id}`);

      const p = data.data;
      return {
        source: AdultMetadataSource.ADULT_DVD_EMPIRE,
        sourceId: p.id,
        name: p.name,
        aliases: p.aliases ?? [],
        birthDate: p.birth_date,
        bio: p.bio,
        gender: p.gender === 'Male'
          ? PerformerGender.MALE
          : p.gender === 'Transgender'
            ? PerformerGender.TRANSGENDER
            : PerformerGender.FEMALE,
        imageUrl: p.image_url,
        thumbnailUrl: p.thumb_url,
        country: p.country,
        height: p.height,
        weight: p.weight,
        measurements: p.measurements,
        sceneCount: p.scene_count,
        active: p.active,
        popularity: 0,
      };
    } catch (e) {
      logger.error('AdultDVDEmpire getPerformer failed', {
        label: 'AdultDVDEmpire',
        errorMessage: e.message,
        performerId: id,
      });
      throw e;
    }
  }

  /**
   * Get scenes for a performer.
   * GET /v1/performers/:id/dvds
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
      const data = await this.get<{
        data: ADEScene[];
        meta: { total: number; page: number };
      }>(`/performers/${performerId}/dvds`, { params });
      return data.data.map((s) => this.mapScene(s));
    } catch (e) {
      logger.error('AdultDVDEmpire getPerformerScenes failed', {
        label: 'AdultDVDEmpire',
        errorMessage: e.message,
        performerId,
      });
      throw e;
    }
  }

  /**
   * Get studio by ID.
   * GET /v1/studios/:id
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
          founded_year?: number;
          scene_count: number;
        };
      }>(`/studios/${id}`);

      return {
        name: data.data.name,
        externalId: data.data.id,
        source: AdultMetadataSource.ADULT_DVD_EMPIRE,
        logoUrl: data.data.logo_url,
        description: data.data.description,
        websiteUrl: data.data.website_url,
        foundedYear: data.data.founded_year,
        sceneCount: data.data.scene_count,
      };
    } catch (e) {
      logger.error('AdultDVDEmpire getStudio failed', {
        label: 'AdultDVDEmpire',
        errorMessage: e.message,
        studioId: id,
      });
      throw e;
    }
  }

  /**
   * Get new releases.
   * GET /v1/dvds/new
   */
  async getNewReleases(options?: {
    page?: number;
    pageSize?: number;
    days?: number;
  }): Promise<{ scenes: AdultSceneResult[]; total: number; page: number }> {
    try {
      const params: Record<string, string | number> = {
        page: options?.page ?? 1,
        per_page: options?.pageSize ?? 25,
        days: options?.days ?? 30,
      };
      const data = await this.get<{
        data: ADEScene[];
        meta: { total: number; page: number };
      }>('/dvds/new', { params });
      return {
        scenes: data.data.map((s) => this.mapScene(s)),
        total: data.meta.total,
        page: data.meta.page,
      };
    } catch (e) {
      logger.error('AdultDVDEmpire getNewReleases failed', {
        label: 'AdultDVDEmpire',
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

export default AdultDVDEmpireAPI;
