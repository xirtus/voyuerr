import ExternalAPI from '@server/api/externalapi';
import logger from '@server/logger';
import ServarrBase from './base';

/**
 * Whisparr scene/movie add options.
 * Matches the standard *arr MoviePayload plus Whisparr-specific fields.
 */
export interface WhisparrSceneOptions {
  title: string;
  studio: string;
  foreignId: string;
  qualityProfileId: number;
  minimumAvailability: string;
  rootFolderPath: string;
  tags: number[];
  monitored?: boolean;
  searchNow?: boolean;
}

/**
 * Whisparr performer add options (Eros branch).
 */
export interface WhisparrPerformerOptions {
  foreignId: string;
  qualityProfileId: number;
  rootFolderPath: string;
  tags: number[];
  monitored?: boolean;
  searchOnAdd?: boolean;
  moviesMonitored?: boolean;
  minimumAvailability?: string;
}

/**
 * Whisparr studio add options (Eros branch).
 */
export interface WhisparrStudioOptions {
  foreignId: string;
  qualityProfileId: number;
  rootFolderPath: string;
  tags: number[];
  monitored?: boolean;
  searchOnAdd?: boolean;
  moviesMonitored?: boolean;
}

/**
 * A Whisparr scene as returned by the API.
 * Maps to the "movie" entity in Whisparr's data model.
 */
export interface WhisparrScene {
  id: number;
  title: string;
  foreignId: string;
  stashId?: string;
  titleSlug: string;
  monitored: boolean;
  hasFile: boolean;
  isAvailable: boolean;
  status: string;
  overview?: string;
  releaseDate?: string;
  year: number;
  studioTitle?: string;
  studioForeignId?: string;
  runtime?: number;
  folderName?: string;
  path?: string;
  qualityProfileId: number;
  rootFolderPath?: string;
  tags: number[];
  genres: string[];
  added: string;
  images?: { coverType: string; url: string; remoteUrl: string }[];
}

/**
 * A Whisparr performer as returned by the API (Eros branch).
 */
export interface WhisparrPerformer {
  id: number;
  fullName: string;
  foreignId: string;
  gender: string;
  status: string;
  monitored: boolean;
  rootFolderPath: string;
  qualityProfileId: number;
  searchOnAdd: boolean;
  tags: number[];
  added: string;
}

/**
 * A Whisparr studio as returned by the API (Eros branch).
 */
export interface WhisparrStudio {
  id: number;
  foreignId: string;
  title: string;
  monitored: boolean;
  network: string;
  qualityProfileId: number;
  rootFolderPath: string;
  searchOnAdd: boolean;
}

/** Scene lookup result from Whisparr's metadata providers. */
export interface WhisparrLookupScene {
  foreignId: string;
  movie: WhisparrScene;
  id: number;
}

/** Performer lookup result. */
export interface WhisparrLookupPerformer {
  foreignId: string;
  performer: WhisparrPerformer;
  id: number;
}

/** Studio lookup result. */
export interface WhisparrLookupStudio {
  foreignId: string;
  studio: WhisparrStudio;
  id: number;
}

class WhisparrAPI extends ServarrBase<{ movieId: number }> {
  constructor({ url, apiKey }: { url: string; apiKey: string }) {
    super({ url, apiKey, cacheName: 'whisparr', apiName: 'Whisparr' });
  }

  // ── Scene (Movie) endpoints ────────────────────────────────────

  /** Get all scenes/movies from Whisparr. */
  public getScenes = async (): Promise<WhisparrScene[]> => {
    try {
      const response =
        await this.axios.get<WhisparrScene[]>('/movie');
      return response.data;
    } catch (e) {
      throw new Error(`[Whisparr] Failed to retrieve scenes: ${e.message}`, {
        cause: e,
      });
    }
  };

  /** Get a single scene by its Whisparr internal ID. */
  public getScene = async ({
    id,
  }: {
    id: number;
  }): Promise<WhisparrScene> => {
    try {
      const response =
        await this.axios.get<WhisparrScene>(`/movie/${id}`);
      return response.data;
    } catch (e) {
      throw new Error(`[Whisparr] Failed to retrieve scene: ${e.message}`, {
        cause: e,
      });
    }
  };

  /** Look up a scene by foreign ID (e.g., stash:xxx or tpdb:xxx). */
  public getSceneByForeignId = async (
    foreignId: string
  ): Promise<WhisparrScene | null> => {
    try {
      const response = await this.axios.get<WhisparrScene[]>('/movie', {
        params: { foreignId },
      });
      return response.data[0] ?? null;
    } catch (e) {
      logger.error('Error retrieving scene by foreign ID', {
        label: 'Whisparr API',
        errorMessage: e.message,
        foreignId,
      });
      return null;
    }
  };

  /**
   * Eros branch: Look up scene metadata from Whisparr's configured
   * metadata providers (ThePornDB, StashDB, etc.).
   * GET /lookup/scene?term=stash:{id}
   */
  public lookupScene = async (
    term: string
  ): Promise<WhisparrLookupScene[]> => {
    try {
      const response = await this.axios.get<WhisparrLookupScene[]>(
        '/lookup/scene',
        { params: { term } }
      );
      return response.data;
    } catch (e) {
      throw new Error(
        `[Whisparr] Failed to lookup scene: ${e.message}`,
        { cause: e }
      );
    }
  };

  /**
   * Add a scene to Whisparr.
   * POST /movie
   */
  public addScene = async (
    options: WhisparrSceneOptions
  ): Promise<WhisparrScene> => {
    try {
      // Check if scene already exists by foreignId
      const existing = await this.getSceneByForeignId(options.foreignId);

      if (existing) {
        if (existing.hasFile) {
          logger.info(
            'Scene already exists and has file. Skipping add.',
            { label: 'Whisparr', scene: existing.title }
          );
          return existing;
        }

        // Scene exists but is not monitored — update it
        if (!existing.monitored) {
          const response = await this.axios.put<WhisparrScene>('/movie', {
            ...existing,
            title: options.title,
            qualityProfileId: options.qualityProfileId,
            minimumAvailability: options.minimumAvailability,
            rootFolderPath: options.rootFolderPath,
            monitored: options.monitored ?? true,
            tags: Array.from(
              new Set([...existing.tags, ...options.tags])
            ),
            addOptions: {
              searchForMovie: options.searchNow,
            },
          });

          if (options.searchNow) {
            this.searchScene(response.data.id);
          }

          return response.data;
        }

        // Already monitored — just search if requested
        if (options.searchNow && !existing.hasFile) {
          this.searchScene(existing.id);
        }

        return existing;
      }

      // New scene — create it
      const response = await this.axios.post<WhisparrScene>('/movie', {
        title: options.title,
        studio: options.studio,
        foreignId: options.foreignId,
        qualityProfileId: options.qualityProfileId,
        minimumAvailability: options.minimumAvailability,
        rootFolderPath: options.rootFolderPath,
        monitored: options.monitored ?? true,
        tags: options.tags,
        addOptions: {
          searchForMovie: options.searchNow,
        },
      });

      logger.info('Whisparr accepted scene request', {
        label: 'Whisparr',
        sceneId: response.data.id,
        title: response.data.title,
      });

      return response.data;
    } catch (e) {
      logger.error('Failed to add scene to Whisparr', {
        label: 'Whisparr',
        errorMessage: e.message,
        options,
        response: e?.response?.data,
      });
      throw new Error('Failed to add scene to Whisparr', { cause: e });
    }
  };

  /** Trigger a search for a specific scene. */
  public searchScene = async (movieId: number): Promise<void> => {
    logger.info('Executing scene search command', {
      label: 'Whisparr API',
      movieId,
    });

    try {
      await this.runCommand('MoviesSearch', { movieIds: [movieId] });
    } catch (e) {
      logger.error(
        'Something went wrong executing Whisparr scene search.',
        {
          label: 'Whisparr API',
          errorMessage: e.message,
          movieId,
        }
      );
    }
  };

  /** Remove a scene from Whisparr (by foreignId). */
  public removeScene = async (foreignId: string): Promise<void> => {
    try {
      const scene = await this.getSceneByForeignId(foreignId);
      if (!scene) {
        throw new Error('Scene not found in Whisparr');
      }
      await this.axios.delete(`/movie/${scene.id}`, {
        params: {
          deleteFiles: true,
          addImportExclusion: false,
        },
      });
      logger.info(`[Whisparr] Removed scene: ${scene.title}`);
    } catch (e) {
      throw new Error(`[Whisparr] Failed to remove scene: ${e.message}`, {
        cause: e,
      });
    }
  };

  // ── Performer endpoints (Eros branch) ──────────────────────────

  /**
   * Eros: Look up performer metadata.
   * GET /lookup/performer?term=X
   */
  public lookupPerformer = async (
    term: string
  ): Promise<WhisparrLookupPerformer[]> => {
    try {
      const response = await this.axios.get<WhisparrLookupPerformer[]>(
        '/lookup/performer',
        { params: { term } }
      );
      return response.data;
    } catch (e) {
      throw new Error(
        `[Whisparr] Failed to lookup performer: ${e.message}`,
        { cause: e }
      );
    }
  };

  /** Get all monitored performers. */
  public getPerformers = async (): Promise<WhisparrPerformer[]> => {
    try {
      const response =
        await this.axios.get<WhisparrPerformer[]>('/performer');
      return response.data;
    } catch (e) {
      throw new Error(
        `[Whisparr] Failed to retrieve performers: ${e.message}`,
        { cause: e }
      );
    }
  };

  /**
   * Add a performer to Whisparr for monitoring.
   * Eros: POST /performer
   */
  public addPerformer = async (
    options: WhisparrPerformerOptions
  ): Promise<WhisparrPerformer> => {
    try {
      const response = await this.axios.post<WhisparrPerformer>(
        '/performer',
        {
          foreignId: options.foreignId,
          qualityProfileId: options.qualityProfileId,
          rootFolderPath: options.rootFolderPath,
          monitored: options.monitored ?? true,
          searchOnAdd: options.searchOnAdd ?? false,
          moviesMonitored: options.moviesMonitored ?? false,
          minimumAvailability:
            options.minimumAvailability ?? 'released',
          tags: options.tags,
        }
      );

      logger.info('Whisparr accepted performer request', {
        label: 'Whisparr',
        performerId: response.data.id,
        name: response.data.fullName,
      });

      return response.data;
    } catch (e) {
      logger.error('Failed to add performer to Whisparr', {
        label: 'Whisparr',
        errorMessage: e.message,
        options,
      });
      throw new Error('Failed to add performer to Whisparr', {
        cause: e,
      });
    }
  };

  // ── Studio endpoints (Eros branch) ─────────────────────────────

  /**
   * Eros: Look up studio metadata.
   * GET /lookup/studio?term=X
   */
  public lookupStudio = async (
    term: string
  ): Promise<WhisparrLookupStudio[]> => {
    try {
      const response = await this.axios.get<WhisparrLookupStudio[]>(
        '/lookup/studio',
        { params: { term } }
      );
      return response.data;
    } catch (e) {
      throw new Error(
        `[Whisparr] Failed to lookup studio: ${e.message}`,
        { cause: e }
      );
    }
  };

  /** Get all monitored studios. */
  public getStudios = async (): Promise<WhisparrStudio[]> => {
    try {
      const response =
        await this.axios.get<WhisparrStudio[]>('/studio');
      return response.data;
    } catch (e) {
      throw new Error(
        `[Whisparr] Failed to retrieve studios: ${e.message}`,
        { cause: e }
      );
    }
  };

  /**
   * Add a studio to Whisparr for monitoring.
   * Eros: POST /studio
   */
  public addStudio = async (
    options: WhisparrStudioOptions
  ): Promise<WhisparrStudio> => {
    try {
      const response = await this.axios.post<WhisparrStudio>(
        '/studio',
        {
          foreignId: options.foreignId,
          qualityProfileId: options.qualityProfileId,
          rootFolderPath: options.rootFolderPath,
          monitored: options.monitored ?? true,
          searchOnAdd: options.searchOnAdd ?? false,
          moviesMonitored: options.moviesMonitored ?? false,
          tags: options.tags,
        }
      );

      logger.info('Whisparr accepted studio request', {
        label: 'Whisparr',
        studioId: response.data.id,
        title: response.data.title,
      });

      return response.data;
    } catch (e) {
      logger.error('Failed to add studio to Whisparr', {
        label: 'Whisparr',
        errorMessage: e.message,
        options,
      });
      throw new Error('Failed to add studio to Whisparr', {
        cause: e,
      });
    }
  };

  // ── Cache management ───────────────────────────────────────────

  public clearSceneCache = ({
    foreignId,
    externalId,
  }: {
    foreignId?: string | null;
    externalId?: number | null;
  }) => {
    if (foreignId) {
      this.removeCache('/movie', { foreignId });
    }
    if (externalId) {
      this.removeCache(`/movie/${externalId}`);
    }
  };
}

export default WhisparrAPI;
