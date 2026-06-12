/**
 * Voyeurr Adult Metadata Provider Types
 *
 * Shared interfaces for all adult metadata providers:
 * ThePornDB, R18.dev, AdultDVDEmpire, nHentai, Fakku, Hanime
 *
 * Phase 8 — Metadata Provider Integration
 */

import type { ContentCategory, PerformerGender } from '@server/constants/content';

/** Confidence score for metadata fields (0.0–1.0). */
export interface ConfidenceScore {
  overall: number;
  title: number;
  description: number;
  performers: number;
  studio: number;
  tags: number;
  releaseDate: number;
  poster: number;
}

/** Source attribution for a metadata field. */
export interface MetadataSource {
  source: AdultMetadataSource;
  sourceId: string;
  sourceUrl?: string;
  confidence: number;
}

/** Enum for all adult metadata sources. */
export enum AdultMetadataSource {
  STASH = 'stash',
  TPDB = 'tpdb',
  R18 = 'r18',
  JAVDB = 'javdb',
  ADULT_DVD_EMPIRE = 'adultdvdempire',
  NHENTAI = 'nhentai',
  FAKKU = 'fakku',
  HANIME = 'hanime',
}

/** Scene search result from any adult metadata provider. */
export interface AdultSceneResult {
  /** Provider source identifier. */
  source: AdultMetadataSource;
  /** Provider-specific ID. */
  sourceId: string;
  /** Scene title. */
  title: string;
  /** Original/native title (e.g., kanji for JAV). */
  originalTitle?: string;
  /** Release date (ISO 8601). */
  releaseDate?: string;
  /** Runtime in minutes. */
  runtime?: number;
  /** Description/synopsis. */
  description?: string;
  /** Content categories. */
  categories: ContentCategory[];
  /** Tags/keywords. */
  tags: string[];
  /** Poster/cover image URL. */
  posterUrl?: string;
  /** Backdrop/fanart image URL. */
  backdropUrl?: string;
  /** Trailer video URL. */
  trailerUrl?: string;
  /** Studio info. */
  studio?: AdultStudioInfo;
  /** Performer list. */
  performers: AdultPerformerInfo[];
  /** Provider URL for this scene. */
  url?: string;
}

/** Performer result from any adult metadata provider. */
export interface AdultPerformerResult {
  source: AdultMetadataSource;
  sourceId: string;
  name: string;
  /** Alternative names / aliases. */
  aliases: string[];
  /** Date of birth. */
  birthDate?: string;
  /** Biography/description. */
  bio?: string;
  /** Gender. */
  gender: PerformerGender;
  /** Profile image URL. */
  imageUrl?: string;
  /** Thumbnail image URL. */
  thumbnailUrl?: string;
  /** Country of origin. */
  country?: string;
  /** Height in cm. */
  height?: number;
  /** Weight in kg. */
  weight?: number;
  /** Physical measurements. */
  measurements?: string;
  /** Number of known scenes. */
  sceneCount: number;
  /** Active status. */
  active: boolean;
  /** Popularity score. */
  popularity: number;
  /** Provider URL. */
  url?: string;
  /** Social media links. */
  socialMedia?: Record<string, string>;
}

/** Studio/network info (subset shared across providers). */
export interface AdultStudioInfo {
  name: string;
  /** Provider-specific external ID. */
  externalId?: string;
  /** Provider source. */
  source?: AdultMetadataSource;
  /** Logo image URL. */
  logoUrl?: string;
  /** Description. */
  description?: string;
  /** Website URL. */
  websiteUrl?: string;
  /** Country. */
  country?: string;
  /** Founded year. */
  foundedYear?: number;
  /** Scene count. */
  sceneCount: number;
  /** Provider URL. */
  url?: string;
}

/** Lightweight performer info for scene results. */
export interface AdultPerformerInfo {
  name: string;
  /** Provider-specific external ID. */
  externalId?: string;
  source?: AdultMetadataSource;
  imageUrl?: string;
  gender?: PerformerGender;
  url?: string;
}

/** Aggregated metadata with source attribution. */
export interface AggregatedSceneMetadata {
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  runtime?: number;
  description?: string;
  categories: ContentCategory[];
  tags: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  studio?: AdultStudioInfo;
  performers: AdultPerformerInfo[];
  /** Source attributions per field. */
  sources: {
    title?: MetadataSource;
    description?: MetadataSource;
    releaseDate?: MetadataSource;
    runtime?: MetadataSource;
    studio?: MetadataSource;
    poster?: MetadataSource;
    backdrop?: MetadataSource;
    trailer?: MetadataSource;
  };
  /** Overall confidence score. */
  confidence: ConfidenceScore;
}

/** Aggregated performer metadata. */
export interface AggregatedPerformerMetadata {
  name: string;
  aliases: string[];
  birthDate?: string;
  bio?: string;
  gender: PerformerGender;
  imageUrl?: string;
  thumbnailUrl?: string;
  country?: string;
  height?: number;
  weight?: number;
  measurements?: string;
  sceneCount: number;
  active: boolean;
  popularity: number;
  /** Mapped external IDs from all sources. */
  externalIds: Record<string, string>;
}

/** Search query parameters for adult metadata providers. */
export interface AdultSearchQuery {
  query: string;
  /** Filter by specific provider(s). */
  providers?: AdultMetadataSource[];
  /** Filter by content category. */
  category?: ContentCategory;
  /** Filter by performer. */
  performerName?: string;
  /** Filter by studio. */
  studioName?: string;
  /** Minimum runtime in minutes. */
  minRuntime?: number;
  /** Maximum runtime in minutes. */
  maxRuntime?: number;
  /** Results per page. */
  pageSize?: number;
  /** Page offset. */
  page?: number;
}

/** Paginated search response. */
export interface AdultSearchResponse<T> {
  results: T[];
  total: number;
  page: number;
  pageSize: number;
  providers: AdultMetadataSource[];
}
