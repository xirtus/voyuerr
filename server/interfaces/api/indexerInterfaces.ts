/**
 * Torznab/Newznab API result interfaces.
 *
 * Both Jackett and Prowlarr implement the Torznab/Newznab protocol
 * defined by the Newznab specification. These interfaces represent
 * the search/caps responses common to both.
 */

/** Torznab/Newznab capability response (t=caps). */
export interface IndexerCaps {
  caps: {
    server?: { title?: string };
    searching?: {
      search?: { available: string; supportedParams: string };
      'tv-search'?: { available: string; supportedParams: string };
      'movie-search'?: { available: string; supportedParams: string };
    };
    categories?: {
      category: IndexerCategory[];
    };
  };
}

/** Recursive category node in the Torznab capability tree. */
export interface IndexerCategory {
  $: { id: string; name: string };
  subcat?: IndexerCategory[];
}

/** Single search result item from a Torznab/Newznab query. */
export interface IndexerSearchResult {
  title: string[];
  guid: string[];
  size: string[];
  link: string[];
  pubDate: string[];
  category: string[];
  description?: string[];
  enclosure: {
    $: { url: string; length: string; type: string };
  }[];
  'newznab:attr'?: {
    $: {
      category: string;
      size: string;
      files: string;
      grabs: string;
      seeders: string;
      leechers: string;
      peers: string;
    };
  }[];
  'torznab:attr'?: {
    $: {
      category: string;
      size: string;
      files: string;
      grabs: string;
      seeders: string;
      leechers: string;
      peers: string;
    };
  }[];
}

/** Top-level Torznab/Newznab search response (RSS 2.0 channel). */
export interface IndexerSearchResponse {
  rss: {
    $: { version: string };
    channel: {
      title: string[];
      description: string[];
      link: string[];
      language: string[];
      item?: IndexerSearchResult[];
      response?: { $: { offset: string; total: string } }[];
    }[];
  };
}

/** Parsed search result for UI consumption. */
export interface ParsedIndexerResult {
  guid: string;
  title: string;
  size: number;
  sizeLabel: string;
  link: string;
  pubDate: string;
  category: string[];
  seeders: number;
  leechers: number;
  peers: number;
  grabs: number;
  indexer: string;
  indexerId: string;
  downloadUrl: string;
}

/** Indexer health status. */
export interface IndexerHealth {
  id: string;
  name: string;
  uptime: boolean;
  responseTime: number;
  resultCount: number;
  lastChecked: string;
  error?: string;
}

/** Newznab category ID constants for adult content. */
export const ADULT_CATEGORIES: Record<string, number[]> = {
  all: [5000, 6000],
  xxx: [5000],
  xxx_x264: [6000],
};

/** Category presets for common adult content types. */
export const ADULT_CATEGORY_PRESETS: Record<string, { name: string; ids: number[] }> = {
  all: { name: 'All Adult (5000+)', ids: [5000, 6000] },
  xxx: { name: 'XXX General (5000)', ids: [5000] },
  xxx264: { name: 'XXX x264 (6000)', ids: [6000] },
};

/**
 * Maps adult content categories to Newznab category IDs.
 * These are the most common mappings used across indexers.
 */
export const CATEGORY_TO_NEWZNAB: Record<string, number[]> = {
  western: [5000],
  jav: [5000],
  hentai: [5000],
  amateur: [5000],
  vr: [5000],
  gay: [5000],
  trans: [5000],
};
