/**
 * Adult Metadata Scanner / Syncer
 *
 * Periodically refreshes scene, performer, and studio metadata from
 * enabled adult content providers. Ensures Voyeurr's content database
 * stays current with external metadata sources.
 *
 * Handles:
 *  - Incremental updates (check for new/modified items)
 *  - Full resync from all enabled providers
 *  - Performer enrichment (cross-reference, external IDs)
 *  - Studio metadata refresh
 *
 * Phase 8 — Metadata Provider Integration
 */

import { getRepository } from '@server/datasource';
import Performer from '@server/entity/Performer';
import Scene from '@server/entity/Scene';
import Studio from '@server/entity/Studio';
import metadataAggregator from '@server/api/adult/metadataAggregator';
import { PerformerCrossReference } from '@server/api/adult/performerCrossReference';
import ThePornDB from '@server/api/adult/tpdb';
import R18API from '@server/api/adult/r18';
import NHentai from '@server/api/adult/nhentai';
import HanimeAPI from '@server/api/adult/hanime';
import FakkuAPI from '@server/api/adult/fakku';
import { AdultMetadataSource } from '@server/api/adult/types';
import type { AggregatedPerformerMetadata, AggregatedSceneMetadata } from '@server/api/adult/types';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

class AdultMetadataScanner {
  public isRefreshing = false;
  public lastRefresh: Date | null = null;
  private running = false;

  get status(): { running: boolean; isRefreshing: boolean; lastRefresh: Date | null } {
    return {
      running: this.running,
      isRefreshing: this.isRefreshing,
      lastRefresh: this.lastRefresh,
    };
  }

  /**
   * Run full metadata refresh from all enabled providers.
   */
  async run(): Promise<void> {
    if (this.running) {
      logger.info('Adult metadata scanner already running — skipping', {
        label: 'AdultScanner',
      });
      return;
    }

    this.running = true;
    this.isRefreshing = true;

    try {
      logger.info('Starting adult metadata refresh', { label: 'AdultScanner' });
      await this.refreshAll();
      this.lastRefresh = new Date();
      logger.info('Adult metadata refresh completed', { label: 'AdultScanner' });
    } catch (e) {
      logger.error('Adult metadata refresh failed', {
        label: 'AdultScanner',
        errorMessage: e.message,
      });
    } finally {
      this.running = false;
      this.isRefreshing = false;
    }
  }

  /**
   * Refresh all content types.
   */
  async refreshAll(): Promise<void> {
    await Promise.all([
      this.refreshScenes(),
      this.refreshPerformers(),
      this.refreshStudios(),
    ]);
  }

  /**
   * Refresh scene metadata: pull recent updates from enabled providers
   * and update existing scenes with enriched metadata.
   */
  async refreshScenes(): Promise<void> {
    const enabledProviders = metadataAggregator.getEnabledProviders();
    if (!enabledProviders.length) return;

    const sceneRepository = getRepository(Scene);

    try {
      // Get scenes that have external IDs from enabled providers
      const scenes = await sceneRepository.find({
        where: enabledProviders.map((source) => ({
          externalSource: source,
        })),
        take: 100, // Batch size
      });

      logger.info(`Refreshing metadata for ${scenes.length} scenes`, {
        label: 'AdultScanner',
      });

      for (const scene of scenes) {
        try {
          await this.refreshScene(scene);
        } catch (e) {
          logger.warn(`Failed to refresh scene ${scene.id}`, {
            label: 'AdultScanner',
            errorMessage: e.message,
          });
        }
      }
    } catch (e) {
      logger.error('Scene metadata refresh failed', {
        label: 'AdultScanner',
        errorMessage: e.message,
      });
    }
  }

  /**
   * Refresh a single scene's metadata from its external source.
   */
  async refreshScene(scene: Scene): Promise<void> {
    const source = scene.externalSource as AdultMetadataSource;
    const aggregated = await metadataAggregator.getAggregatedScene(
      scene.externalId,
      source,
      true // cross-check other providers
    );

    if (!aggregated) return;

    const sceneRepository = getRepository(Scene);

    // Update enriched fields if confidence is high enough
    if (aggregated.confidence.overall > 0.7) {
      if (aggregated.description && !scene.description) {
        scene.description = aggregated.description;
      }
      if (aggregated.tags.length > 0) {
        scene.tags = aggregated.tags.join(',');
      }
      if (aggregated.posterUrl && !scene.posterUrl) {
        scene.posterUrl = aggregated.posterUrl;
      }
      if (aggregated.backdropUrl && !scene.backdropUrl) {
        scene.backdropUrl = aggregated.backdropUrl;
      }
      if (aggregated.trailerUrl && !scene.trailerUrl) {
        scene.trailerUrl = aggregated.trailerUrl;
      }
      if (aggregated.runtime && !scene.runtime) {
        scene.runtime = aggregated.runtime;
      }

      // Merge external IDs
      const existingIds = scene.externalIds ? JSON.parse(scene.externalIds) : {};
      if (aggregated.sources) {
        for (const [field, attrib] of Object.entries(aggregated.sources)) {
          if (attrib && attrib.source !== source && !existingIds[attrib.source]) {
            existingIds[attrib.source] = attrib.sourceId;
          }
        }
        scene.externalIds = JSON.stringify(existingIds);
      }

      await sceneRepository.save(scene);
      logger.debug(`Updated scene ${scene.id} metadata from aggregator`, {
        label: 'AdultScanner',
      });
    }
  }

  /**
   * Refresh performer metadata: enrich existing performers with
   * data from enabled providers.
   */
  async refreshPerformers(): Promise<void> {
    const enabledProviders = metadataAggregator.getEnabledProviders();
    if (!enabledProviders.length) return;

    const performerRepository = getRepository(Performer);

    try {
      // Get performers that need enrichment (no external IDs or missing data)
      const performers = await performerRepository.find({
        take: 50, // Batch size
      });

      logger.info(`Refreshing metadata for ${performers.length} performers`, {
        label: 'AdultScanner',
      });

      for (const performer of performers) {
        try {
          // Try to find this performer in metadata providers
          const aggregated = await metadataAggregator.getAggregatedPerformer(
            performer.name
          );

          if (aggregated && aggregated.externalIds) {
            // Update performer with cross-referenced data
            const existingIds = performer.externalIds
              ? JSON.parse(performer.externalIds)
              : {};
            const mergedIds = { ...existingIds, ...aggregated.externalIds };

            performer.externalIds = JSON.stringify(mergedIds);

            if (aggregated.bio && !performer.bio) {
              performer.bio = aggregated.bio;
            }
            if (aggregated.imageUrl && !performer.imageUrl) {
              performer.imageUrl = aggregated.imageUrl;
            }
            if (aggregated.birthDate && !performer.birthDate) {
              performer.birthDate = aggregated.birthDate;
            }
            if (aggregated.height && !performer.height) {
              performer.height = aggregated.height;
            }
            if (aggregated.weight && !performer.weight) {
              performer.weight = aggregated.weight;
            }
            if (aggregated.measurements && !performer.measurements) {
              performer.measurements = aggregated.measurements;
            }
            if (aggregated.country && !performer.country) {
              performer.country = aggregated.country;
            }
            if (aggregated.popularity > 0) {
              performer.popularity = aggregated.popularity;
            }
            if (aggregated.sceneCount > performer.sceneCount) {
              performer.sceneCount = aggregated.sceneCount;
            }

            await performerRepository.save(performer);
          }
        } catch (e) {
          logger.warn(`Failed to refresh performer ${performer.id}`, {
            label: 'AdultScanner',
            errorMessage: e.message,
          });
        }
      }
    } catch (e) {
      logger.error('Performer metadata refresh failed', {
        label: 'AdultScanner',
        errorMessage: e.message,
      });
    }
  }

  /**
   * Refresh studio metadata.
   */
  async refreshStudios(): Promise<void> {
    const enabledProviders = metadataAggregator.getEnabledProviders();
    if (!enabledProviders.length) return;

    const studioRepository = getRepository(Studio);

    try {
      const studios = await studioRepository.find({ take: 50 });

      logger.info(`Refreshing metadata for ${studios.length} studios`, {
        label: 'AdultScanner',
      });

      for (const studio of studios) {
        try {
          // Studio cross-referencing is provider-specific
          // For now, enrich if we have external IDs
          const externalIds = studio.externalIds
            ? JSON.parse(studio.externalIds)
            : {};

          for (const source of enabledProviders) {
            const extId = externalIds[source];
            if (!extId) continue;

            try {
              let studioInfo;
              switch (source) {
                case AdultMetadataSource.TPDB:
                  studioInfo = await new ThePornDB().getStudio(extId);
                  break;
                case AdultMetadataSource.R18:
                  studioInfo = await new R18API().getStudio(extId);
                  break;
              }

              if (studioInfo) {
                if (!studio.description && studioInfo.description) {
                  studio.description = studioInfo.description;
                }
                if (!studio.logoUrl && studioInfo.logoUrl) {
                  studio.logoUrl = studioInfo.logoUrl;
                }
                if (!studio.websiteUrl && studioInfo.websiteUrl) {
                  studio.websiteUrl = studioInfo.websiteUrl;
                }
                if (!studio.foundedYear && studioInfo.foundedYear) {
                  studio.foundedYear = studioInfo.foundedYear;
                }
                if (!studio.country && studioInfo.country) {
                  studio.country = studioInfo.country;
                }
                if (studioInfo.sceneCount > studio.sceneCount) {
                  studio.sceneCount = studioInfo.sceneCount;
                }
              }
            } catch {
              // Skip failed provider lookups
            }
          }

          await studioRepository.save(studio);
        } catch (e) {
          logger.warn(`Failed to refresh studio ${studio.id}`, {
            label: 'AdultScanner',
            errorMessage: e.message,
          });
        }
      }
    } catch (e) {
      logger.error('Studio metadata refresh failed', {
        label: 'AdultScanner',
        errorMessage: e.message,
      });
    }
  }

  /**
   * Cancel a running refresh (graceful stop).
   */
  cancel(): void {
    if (this.running) {
      logger.info('Adult metadata refresh cancelled', { label: 'AdultScanner' });
      this.running = false;
    }
  }
}

const adultScanner = new AdultMetadataScanner();
export default adultScanner;
