import ExternalAPI from '@server/api/externalapi';
import logger from '@server/logger';

/**
 * Stash API Client
 *
 * Interfaces with Stash (stashapp.cc) — the open-source adult content organizer.
 * Stash provides a comprehensive GraphQL API for performers, scenes, studios, and tags.
 *
 * Phase 5 — Media Server & Library Integration
 */

export interface StashPerformer {
  id: string;
  name: string;
  disambiguation?: string;
  alias_list?: string[];
  gender?: string;
  birthdate?: string;
  country?: string;
  height_cm?: number;
  weight?: number;
  measurements?: string;
  image_path?: string;
  scene_count?: number;
  favorite?: boolean;
  rating100?: number;
  details?: string;
  url?: string;
  twitter?: string;
  instagram?: string;
}

export interface StashScene {
  id: string;
  title?: string;
  details?: string;
  date?: string;
  studio?: { id: string; name: string; image_path?: string };
  performers?: { id: string; name: string; image_path?: string }[];
  tags?: { id: string; name: string }[];
  path?: string;
  file?: {
    size: string;
    duration: number;
    video_codec: string;
    width: number;
    height: number;
    frame_rate: number;
  };
  rating100?: number;
  o_counter?: number;
  organized?: boolean;
  image_path?: string;  // cover/screenshot
}

export interface StashStudio {
  id: string;
  name: string;
  image_path?: string;
  parent_studio?: { id: string; name: string };
  scene_count?: number;
  details?: string;
  url?: string;
  rating100?: number;
}

export interface StashFindScenesResult {
  findScenes: {
    count: number;
    scenes: StashScene[];
  };
}

export interface StashFindPerformersResult {
  findPerformers: {
    count: number;
    performers: StashPerformer[];
  };
}

export interface StashFindStudiosResult {
  findStudios: {
    count: number;
    studios: StashStudio[];
  };
}

export interface StashSceneResult {
  findScene: StashScene;
}

class StashAPI extends ExternalAPI {
  private apiKey?: string;

  constructor(hostname: string, apiKey?: string) {
    super(
      hostname,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'ApiKey': apiKey } : {}),
        },
      }
    );
    this.apiKey = apiKey;
  }

  /**
   * Execute a GraphQL query against the Stash API.
   * Stash uses POST to /graphql with JSON body { query, variables }.
   */
  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    try {
      const response = await this.post<{ data: T; errors?: { message: string }[] }>(
        '/graphql',
        { query, variables },
        { timeout: 30000 }
      );

      if (response.errors?.length) {
        throw new Error(`Stash GraphQL error: ${response.errors[0].message}`);
      }

      return response.data;
    } catch (e) {
      logger.error('Stash API request failed', {
        label: 'Stash API',
        errorMessage: e.message,
      });
      throw e;
    }
  }

  /** Find scenes with optional filtering/pagination. */
  async findScenes(filter?: {
    per_page?: number;
    sort?: string;
    direction?: 'ASC' | 'DESC';
  }): Promise<StashScene[]> {
    const query = `
      query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
        findScenes(filter: $filter, scene_filter: $scene_filter) {
          count
          scenes {
            id
            title
            details
            date
            studio { id name image_path }
            performers { id name image_path }
            tags { id name }
            path
            rating100
            o_counter
            organized
          }
        }
      }
    `;
    const variables = {
      filter: {
        per_page: filter?.per_page ?? 100,
        sort: filter?.sort ?? 'date',
        direction: filter?.direction ?? 'DESC',
      },
    };
    const result = await this.graphql<StashFindScenesResult>(query, variables);
    return result.findScenes.scenes;
  }

  /** Get a single scene by ID. */
  async getScene(id: string): Promise<StashScene> {
    const query = `
      query FindScene($id: ID!) {
        findScene(id: $id) {
          id title details date
          studio { id name image_path }
          performers { id name image_path }
          tags { id name }
          path
          file { size duration video_codec width height frame_rate }
          rating100 o_counter organized
        }
      }
    `;
    const result = await this.graphql<StashSceneResult>(query, { id });
    return result.findScene;
  }

  /** Find performers. */
  async findPerformers(filter?: {
    per_page?: number;
    sort?: string;
    direction?: 'ASC' | 'DESC';
  }): Promise<StashPerformer[]> {
    const query = `
      query FindPerformers($filter: FindFilterType) {
        findPerformers(filter: $filter) {
          count
          performers {
            id
            name
            disambiguation
            alias_list
            gender
            birthdate
            country
            height_cm
            weight
            measurements
            image_path
            scene_count
            favorite
            rating100
            details
          }
        }
      }
    `;
    const variables = {
      filter: {
        per_page: filter?.per_page ?? 100,
        sort: filter?.sort ?? 'name',
        direction: filter?.direction ?? 'ASC',
      },
    };
    const result = await this.graphql<StashFindPerformersResult>(query, variables);
    return result.findPerformers.performers;
  }

  /** Get a single performer by ID. */
  async getPerformer(id: string): Promise<StashPerformer> {
    const query = `
      query FindPerformer($id: ID!) {
        findPerformer(id: $id) {
          id name disambiguation alias_list gender birthdate country
          height_cm weight measurements image_path scene_count favorite
          rating100 details url twitter instagram
        }
      }
    `;
    const result = await this.graphql<{ findPerformer: StashPerformer }>(query, { id });
    return result.findPerformer;
  }

  /** Find studios. */
  async findStudios(filter?: {
    per_page?: number;
    sort?: string;
    direction?: 'ASC' | 'DESC';
  }): Promise<StashStudio[]> {
    const query = `
      query FindStudios($filter: FindFilterType) {
        findStudios(filter: $filter) {
          count
          studios {
            id
            name
            image_path
            parent_studio { id name }
            scene_count
            details
            url
            rating100
          }
        }
      }
    `;
    const variables = {
      filter: {
        per_page: filter?.per_page ?? 100,
        sort: filter?.sort ?? 'name',
        direction: filter?.direction ?? 'ASC',
      },
    };
    const result = await this.graphql<StashFindStudiosResult>(query, variables);
    return result.findStudios.studios;
  }

  /** Get a single studio by ID. */
  async getStudio(id: string): Promise<StashStudio> {
    const query = `
      query FindStudio($id: ID!) {
        findStudio(id: $id) {
          id name image_path
          parent_studio { id name }
          scene_count details url rating100
        }
      }
    `;
    const result = await this.graphql<{ findStudio: StashStudio }>(query, { id });
    return result.findStudio;
  }

  /** Get scenes for a specific performer. */
  async getPerformerScenes(performerId: string, filter?: {
    per_page?: number;
  }): Promise<StashScene[]> {
    const query = `
      query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
        findScenes(filter: $filter, scene_filter: $scene_filter) {
          count
          scenes {
            id title details date
            studio { id name image_path }
            performers { id name image_path }
            tags { id name }
            rating100
          }
        }
      }
    `;
    const variables = {
      filter: {
        per_page: filter?.per_page ?? 100,
        sort: 'date',
        direction: 'DESC',
      },
      scene_filter: {
        performers: { value: [performerId], modifier: 'INCLUDES' },
      },
    };
    const result = await this.graphql<StashFindScenesResult>(query, variables);
    return result.findScenes.scenes;
  }

  /** Verify connection by performing a simple query. */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.graphql<{ systemStatus: { databaseSchema: number } }>(
        `query { systemStatus { databaseSchema } }`
      );
      return !!result.systemStatus;
    } catch {
      return false;
    }
  }
}

export default StashAPI;
