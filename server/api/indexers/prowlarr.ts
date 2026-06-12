import type {
  IndexerSearchResponse,
  IndexerHealth,
} from '@server/interfaces/api/indexerInterfaces';
import logger from '@server/logger';
import IndexerBase from './base';

/** Prowlarr indexer as returned by its REST API. */
export interface ProwlarrIndexer {
  id: number;
  name: string;
  enable: boolean;
  protocol: string;
  priority: number;
  configContract: string;
  fields: {
    name: string;
    value?: unknown;
  }[];
  implementation: string;
  implementationName: string;
  tags: number[];
  added: string;
  capabilities?: unknown;
}

/** System status from Prowlarr. */
export interface ProwlarrSystemStatus {
  version: string;
  buildTime: string;
  isDebug: boolean;
  isProduction: boolean;
  isAdmin: boolean;
  isUserInteractive: boolean;
  startupPath: string;
  appData: string;
  osName: string;
  osVersion: string;
  isMono: boolean;
  isLinux: boolean;
  isOsx: boolean;
  isWindows: boolean;
  isDocker: boolean;
  mode: string;
  branch: string;
  authentication: string;
  urlBase: string;
  runtimeVersion: string;
  runtimeName: string;
}

/**
 * Prowlarr API client.
 *
 * Prowlarr provides a RESTful API at /api/v1 plus a Newznab-compatible
 * endpoint per-indexer at /api/v1/indexer/{id}/newznab
 */
class ProwlarrAPI extends IndexerBase {
  private baseApiUrl: string;

  constructor({
    url,
    apiKey,
  }: {
    url: string;
    apiKey: string;
  }) {
    super({ url, apiKey });
    this.baseApiUrl = url;
  }

  // ── System ────────────────────────────────────────────────────

  /** Get system status/version. */
  public getSystemStatus = async (): Promise<ProwlarrSystemStatus> => {
    try {
      const response = await this.axios.get<ProwlarrSystemStatus>(
        '/api/v1/system/status',
        { headers: { 'X-Api-Key': this.apiKey } }
      );
      return response.data;
    } catch (e) {
      throw new Error(`[Prowlarr] Failed to get system status: ${e.message}`);
    }
  };

  /** Test connection. */
  public testConnection = async (): Promise<{ version: string }> => {
    try {
      const status = await this.getSystemStatus();
      return { version: status.version };
    } catch (e) {
      throw new Error(`[Prowlarr] Connection test failed: ${e.message}`);
    }
  };

  // ── Indexer CRUD ──────────────────────────────────────────────

  /** List all indexers. */
  public getIndexers = async (): Promise<ProwlarrIndexer[]> => {
    try {
      const response = await this.axios.get<ProwlarrIndexer[]>(
        '/api/v1/indexer',
        { headers: { 'X-Api-Key': this.apiKey } }
      );
      return response.data;
    } catch (e) {
      throw new Error(`[Prowlarr] Failed to get indexers: ${e.message}`);
    }
  };

  /** Get a specific indexer by ID. */
  public getIndexer = async (id: number): Promise<ProwlarrIndexer> => {
    try {
      const response = await this.axios.get<ProwlarrIndexer>(
        `/api/v1/indexer/${id}`,
        { headers: { 'X-Api-Key': this.apiKey } }
      );
      return response.data;
    } catch (e) {
      throw new Error(`[Prowlarr] Failed to get indexer ${id}: ${e.message}`);
    }
  };

  /** Test an indexer configuration. */
  public testIndexer = async (
    indexerData: Record<string, unknown>
  ): Promise<boolean> => {
    try {
      await this.axios.post('/api/v1/indexer/test', indexerData, {
        headers: { 'X-Api-Key': this.apiKey },
      });
      return true;
    } catch (e) {
      logger.warn('[Prowlarr] Indexer test failed', { error: e.message });
      return false;
    }
  };

  // ── Search via Newznab ────────────────────────────────────────

  /**
   * Search a specific Prowlarr indexer via its Newznab endpoint.
   * Endpoint: /api/v1/indexer/{id}/newznab?apikey=...
   */
  public searchIndexer = async (
    indexerId: number,
    query: string,
    categories?: number[]
  ): Promise<IndexerSearchResponse> => {
    const newznabUrl = `${this.baseApiUrl}/${indexerId}/api`;
    try {
      return await this.search(newznabUrl, query, categories);
    } catch (e) {
      throw new Error(
        `[Prowlarr] Failed to search indexer ${indexerId}: ${e.message}`
      );
    }
  };

  /**
   * Search across all Prowlarr indexers via the aggregate Newznab endpoint.
   */
  public searchAll = async (
    query: string,
    categories?: number[]
  ): Promise<IndexerSearchResponse> => {
    const newznabUrl = `${this.baseApiUrl}/api/v1/search`;
    const params: Record<string, string | number> = {
      query,
      type: 'search',
      extended: 1,
      limit: 100,
      offset: 0,
    };

    if (categories && categories.length > 0) {
      params.categories = categories.join(',');
    }

    try {
      const response = await this.axios.get<string>(newznabUrl, {
        params,
        headers: { 'X-Api-Key': this.apiKey },
        responseType: 'text',
      });

      return this.parseXmlResponse(response.data as string);
    } catch (e) {
      // Fallback: try per-indexer Newznab
      logger.warn(
        `[Prowlarr] Aggregate search failed, falling back to per-indexer: ${e.message}`
      );

      const indexers = await this.getIndexers();
      const enabled = indexers.filter((i) => i.enable);

      // Return empty response if no enabled indexers
      const emptyResponse: IndexerSearchResponse = {
        rss: {
          $: { version: '2.0' },
          channel: [
            {
              title: ['Prowlarr Fallback Search'],
              description: ['Fallback search results'],
              link: [''],
              language: ['en-us'],
              item: [],
            },
          ],
        },
      };

      for (const idx of enabled) {
        try {
          const result = await this.searchIndexer(
            idx.id,
            query,
            categories
          );
          if (result?.rss?.channel?.[0]?.item) {
            emptyResponse.rss.channel[0].item = [
              ...(emptyResponse.rss.channel[0].item ?? []),
              ...result.rss.channel[0].item,
            ];
          }
        } catch {
          // Skip failed indexers
        }
      }

      return emptyResponse;
    }
  };

  // ── Health ────────────────────────────────────────────────────

  /** Check health of all enabled indexers. */
  public checkHealth = async (): Promise<IndexerHealth[]> => {
    const results: IndexerHealth[] = [];

    try {
      const indexers = await this.getIndexers();
      const enabled = indexers.filter((i) => i.enable);

      for (const indexer of enabled) {
        const start = Date.now();
        try {
          const searchResult = await this.searchIndexer(
            indexer.id,
            'test',
            [5000]
          );
          const items =
            searchResult?.rss?.channel?.[0]?.item ?? [];

          results.push({
            id: String(indexer.id),
            name: indexer.name,
            uptime: true,
            responseTime: Date.now() - start,
            resultCount: items.length,
            lastChecked: new Date().toISOString(),
          });
        } catch (e) {
          results.push({
            id: String(indexer.id),
            name: indexer.name,
            uptime: false,
            responseTime: Date.now() - start,
            resultCount: 0,
            lastChecked: new Date().toISOString(),
            error: e.message,
          });
        }
      }
    } catch (e) {
      logger.error('[Prowlarr] Health check failed', { error: e.message });
    }

    return results;
  };
}

export default ProwlarrAPI;
