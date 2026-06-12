import ExternalAPI from '@server/api/externalapi';
import type { IndexerCaps, IndexerSearchResponse } from '@server/interfaces/api/indexerInterfaces';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '_text',
  isArray: (name) =>
    ['item', 'category', 'subcat', 'enclosure', 'newznab:attr', 'torznab:attr'].includes(
      name
    ),
});

/**
 * Base class for Torznab/Newznab indexer APIs.
 *
 * Both Jackett and Prowlarr expose indexers via Torznab-compatible endpoints.
 * This base class handles XML parsing and common search/caps operations.
 */
abstract class IndexerBase extends ExternalAPI {
  protected apiKey: string;

  constructor({
    url,
    apiKey,
  }: {
    url: string;
    apiKey: string;
  }) {
    super(url, {}, {});
    this.apiKey = apiKey;
  }

  /** Parse an XML string into a Torznab/Newznab search response. */
  protected parseXmlResponse(xml: string): IndexerSearchResponse {
    return parser.parse(xml) as IndexerSearchResponse;
  }

  /** Parse an XML string into a Torznab/Newznab caps response. */
  protected parseCapsResponse(xml: string): IndexerCaps {
    return parser.parse(xml) as IndexerCaps;
  }

  /**
   * Fetch capabilities from a Torznab endpoint.
   * @param torznabUrl - Full URL to the Torznab endpoint (incl. apikey)
   */
  public async getCaps(torznabUrl: string): Promise<IndexerCaps> {
    const response = await this.axios.get<string>(torznabUrl, {
      params: { t: 'caps' },
      responseType: 'text',
    });
    return this.parseCapsResponse(response.data as string);
  }

  /**
   * Search a Torznab endpoint.
   * @param torznabUrl - Full URL to the Torznab endpoint
   * @param query - Search query
   * @param categories - Array of Newznab category IDs
   * @param type - Search type (search, movie, tvsearch)
   */
  public async search(
    torznabUrl: string,
    query: string,
    categories?: number[],
    type: 'search' | 'movie' | 'tvsearch' = 'search'
  ): Promise<IndexerSearchResponse> {
    const params: Record<string, string | number> = {
      t: type,
      q: query,
      extended: 1,
    };

    if (categories && categories.length > 0) {
      params.cat = categories.join(',');
    }

    const response = await this.axios.get<string>(torznabUrl, {
      params,
      responseType: 'text',
    });

    return this.parseXmlResponse(response.data as string);
  }

  /** Format bytes to human-readable size. */
  public static formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[Math.min(i, units.length - 1)]}`;
  }
}

export default IndexerBase;
