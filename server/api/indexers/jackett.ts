import type {
  IndexerSearchResponse,
  IndexerHealth,
  IndexerCaps,
} from '@server/interfaces/api/indexerInterfaces';
import logger from '@server/logger';
import IndexerBase from './base';

/** An individual indexer as reported by Jackett's API. */
export interface JackettIndexer {
  id: string;
  name: string;
  description: string;
  type: string;
  configured: boolean;
  site_link: string;
  language: string;
  last_error: string | null;
  potatoenabled: boolean;
  capabilities?: IndexerCaps['caps'];
}

/** Response from GET /api/v2.0/indexers */
export interface JackettIndexersResponse {
  indexers: JackettIndexer[];
  isConfigured: string[];
  isUnconfigured: string[];
}

/** Response from GET /api/v2.0/server/config */
export interface JackettServerConfig {
  port: number;
  allowexternal: boolean;
  localbindaddress: string;
  blackholedir: string;
  updatedisabled: boolean;
  prerelease: boolean;
  logging: boolean;
  basepathoverride: string;
  baseurloverride: string;
  cacheenabled: boolean;
  cachettl: number;
  cachemaxresultsperindexer: number;
  proxy_type: number;
  proxy_url: string;
  proxy_port: number;
  proxy_username: string;
  proxy_password: string;
  omdbkey: string;
  omdburl: string;
  app_version: string;
  canberenamed: boolean;
  proxyauth: boolean;
}

/**
 * Jackett API client.
 *
 * Jackett exposes a REST API at /api/v2.0 plus Torznab feeds at
 * /api/v2.0/indexers/{name}/results/torznab
 */
class JackettAPI extends IndexerBase {
  private baseApiUrl: string;

  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url: `${url}/api/v2.0`, apiKey });
    this.baseApiUrl = url;
  }

  // ── Server APIs ──────────────────────────────────────────────

  /** Get server configuration and version. */
  public getServerConfig = async (): Promise<JackettServerConfig> => {
    try {
      const response = await this.axios.get<JackettServerConfig>(
        '/server/config',
        { params: { apikey: this.apiKey } }
      );
      return response.data;
    } catch (e) {
      throw new Error(`[Jackett] Failed to retrieve server config: ${e.message}`);
    }
  };

  /** Test the connection and return version info. */
  public testConnection = async (): Promise<{ version: string }> => {
    try {
      const config = await this.getServerConfig();
      return { version: config.app_version };
    } catch (e) {
      throw new Error(`[Jackett] Connection test failed: ${e.message}`);
    }
  };

  // ── Indexer APIs ─────────────────────────────────────────────

  /** List all indexers (configured and unconfigured). */
  public getIndexers = async (): Promise<JackettIndexersResponse> => {
    try {
      const response = await this.axios.get<JackettIndexersResponse>(
        '/indexers',
        { params: { apikey: this.apiKey, configured: 'all' } }
      );
      return response.data;
    } catch (e) {
      throw new Error(`[Jackett] Failed to retrieve indexers: ${e.message}`);
    }
  };

  /** Get capabilities for a specific indexer. */
  public getIndexerCaps = async (indexerId: string): Promise<IndexerCaps | null> => {
    try {
      const torznabUrl = `${this.baseApiUrl}/api/v2.0/indexers/${indexerId}/results/torznab`;
      return await this.getCaps(torznabUrl);
    } catch (e) {
      logger.warn(`[Jackett] Failed to get caps for indexer ${indexerId}`, {
        error: e.message,
      });
      return null;
    }
  };

  /**
   * Search a specific indexer via its Torznab endpoint.
   *
   * Uses Jackett's per-indexer Torznab URL:
   * /api/v2.0/indexers/{id}/results/torznab?apikey=...&t=search&q=...
   */
  public searchIndexer = async (
    indexerId: string,
    query: string,
    categories?: number[]
  ): Promise<IndexerSearchResponse> => {
    const torznabUrl = `${this.baseApiUrl}/api/v2.0/indexers/${indexerId}/results/torznab`;
    try {
      return await this.search(torznabUrl, query, categories);
    } catch (e) {
      throw new Error(
        `[Jackett] Failed to search indexer ${indexerId}: ${e.message}`
      );
    }
  };

  /**
   * Search across ALL configured indexers simultaneously.
   *
   * Uses Jackett's "all" aggregate endpoint.
   */
  public searchAll = async (
    query: string,
    categories?: number[]
  ): Promise<IndexerSearchResponse> => {
    const torznabUrl = `${this.baseApiUrl}/api/v2.0/indexers/all/results/torznab`;
    try {
      return await this.search(torznabUrl, query, categories);
    } catch (e) {
      throw new Error(`[Jackett] Failed to search all indexers: ${e.message}`);
    }
  };

  // ── Health ────────────────────────────────────────────────────

  /** Check health of all configured indexers. */
  public checkHealth = async (): Promise<IndexerHealth[]> => {
    const results: IndexerHealth[] = [];
    const startTime = Date.now();

    try {
      const { indexers } = await this.getIndexers();
      const configured = indexers.filter((i) => i.configured);

      for (const indexer of configured) {
        const idxStart = Date.now();
        try {
          const searchResult = await this.searchIndexer(
            indexer.id,
            'test',
            [5000]
          );
          const items =
            searchResult?.rss?.channel?.[0]?.item ?? [];

          results.push({
            id: indexer.id,
            name: indexer.name,
            uptime: true,
            responseTime: Date.now() - idxStart,
            resultCount: items.length,
            lastChecked: new Date().toISOString(),
          });
        } catch (e) {
          results.push({
            id: indexer.id,
            name: indexer.name,
            uptime: false,
            responseTime: Date.now() - idxStart,
            resultCount: 0,
            lastChecked: new Date().toISOString(),
            error: e.message,
          });
        }
      }
    } catch (e) {
      logger.error('[Jackett] Health check failed', { error: e.message });
    }

    return results;
  };
}

export default JackettAPI;
