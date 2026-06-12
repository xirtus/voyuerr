/**
 * Voyeurr Content Model Constants
 *
 * Replaces the binary Movie/TV paradigm with the adult content taxonomy:
 * scenes, performers, studios, channels, collections, and releases.
 *
 * Phase 1 — Content Model Redesign
 */

/** Primary content type (the "what" of the media). */
export enum ContentType {
  /** Single scene release. Most common unit of adult content. 20–60 min. */
  SCENE = 'scene',
  /** Full-length adult film. 60–180 min. Narrative structure. DVD/VOD release. */
  MOVIE = 'movie',
  /** Recurring release from a specific channel/studio (e.g., "Tushy Raw V47"). */
  CHANNEL_RELEASE = 'channel_release',
  /** Grouped releases forming a series/collection with ordering. */
  COLLECTION = 'collection',
  /** Edited supercut. Multi-scene, multi-performer highlight reel. */
  COMPILATION = 'compilation',
}

/** Regional & genre-based content categories. */
export enum ContentCategory {
  /** US/EU professional productions — Brazzers, Vixen, Blacked, etc. */
  WESTERN = 'western',
  /** Japanese Adult Video — censored/uncensored, studio codes, actress IDs. */
  JAV = 'jav',
  /** Animated adult — 2D/3D, manga doujinshi, anime OVAs, visual novels. */
  HENTAI = 'hentai',
  /** Self-produced, creator-direct clips and full scenes. */
  AMATEUR = 'amateur',
  /** 180°/360° stereoscopic. Special playback requirements. */
  VR = 'vr',
  /** Male/male content. */
  GAY = 'gay',
  /** Transgender performer content. */
  TRANS = 'trans',
  /** Mixed-gender, multi-partner, queer/bi content. */
  QUEER = 'queer',
  /** 2160p or greater resolution content. */
  UHD = 'uhd',
  /** Uncensored JAV — mosaic-removed or originally uncensored. */
  UNCENSORED = 'uncensored',
  /** Unreleased/private content — optional, off by default. */
  LEAKED = 'leaked',
  /** 60fps high-frame-rate content. */
  HIGH_FPS = 'high_fps',
}

/** Performer role in a scene. */
export enum PerformerRole {
  /** Primary performer, lead role. */
  STARRING = 'starring',
  /** Secondary performer, supporting role. */
  FEATURING = 'featuring',
  /** Director / behind-camera role. */
  DIRECTING = 'directing',
  /** Producer of the content. */
  PRODUCING = 'producing',
  /** Camera operator. */
  CINEMATOGRAPHY = 'cinematography',
}

/** Performer gender classification. */
export enum PerformerGender {
  FEMALE = 'female',
  MALE = 'male',
  TRANSGENDER = 'transgender',
  NON_BINARY = 'non_binary',
  INTERSEX = 'intersex',
}

/** Release source type. */
export enum ReleaseSource {
  DVD = 'dvd',
  BLURAY = 'bluray',
  WEB = 'web',
  VOD = 'vod',
  ONLYFANS = 'onlyfans',
  FANSLY = 'fansly',
  MANYVIDS = 'manyvids',
  CAMSHOW = 'camshow',
  TUBE = 'tube',
  REMASTERED = 'remastered',
  LEAKED = 'leaked',
}

/** Release quality. */
export enum ReleaseQuality {
  SD = 'sd',
  HD_720P = '720p',
  HD_1080P = '1080p',
  UHD_4K = '4k',
  UHD_8K = '8k',
  VR_4K = 'vr_4k',
  VR_8K = 'vr_8k',
}

/** Scene availability status. */
export enum SceneStatus {
  UNKNOWN = 1,
  PENDING = 2,
  PROCESSING = 3,
  PARTIALLY_AVAILABLE = 4,
  AVAILABLE = 5,
  BLOCKLISTED = 6,
  DELETED = 7,
}

/** Studio relationship type (networks/umbrellas). */
export enum StudioNetworkType {
  PARENT = 'parent',
  SUBSIDIARY = 'subsidiary',
  PARTNER = 'partner',
  INDEPENDENT = 'independent',
}
