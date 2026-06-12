/**
 * Adult Metadata Routes
 *
 * API endpoints for querying adult metadata providers:
 *  - Scene/performer/studio search across all enabled sources
 *  - Single-item lookup by provider ID
 *  - Aggregated metadata retrieval
 *  - Performer cross-referencing
 *  - Manual metadata refresh triggers
 *
 * Phase 8 — Metadata Provider Integration
 */

import { getRepository } from '@server/datasource';
import Performer from '@server/entity/Performer';
import Scene from '@server/entity/Scene';
import Studio from '@server/entity/Studio';
import AdultDVDEmpireAPI from '@server/api/adult/adultdvdempire';
import FakkuAPI from '@server/api/adult/fakku';
import HanimeAPI from '@server/api/adult/hanime';
import metadataAggregator from '@server/api/adult/metadataAggregator';
import NHentai from '@server/api/adult/nhentai';
import {
  PerformerCrossReference,
  resolveIdentityConflict,
} from '@server/api/adult/performerCrossReference';
import R18API from '@server/api/adult/r18';
import ThePornDB from '@server/api/adult/tpdb';
import { AdultMetadataSource } from '@server/api/adult/types';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import adultScanner from '@server/lib/scanners/adult';
import { Router } from 'express';

const router = Router();

router.use(isAuthenticated());

/**
 * GET /adult-metadata/providers
 * List enabled adult metadata providers.
 */
router.get('/providers', (_req, res) => {
  const enabled = metadataAggregator.getEnabledProviders();
  return res.status(200).json({
    providers: enabled,
    all: Object.values(AdultMetadataSource),
  });
});

/**
 * GET /adult-metadata/search/scenes
 * Search across all enabled adult metadata providers.
 */
router.get('/search/scenes', async (req, res, next) => {
  try {
    const { query, provider, category, performer, studio, page, pageSize } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    const providers = provider
      ? (typeof provider === 'string' ? [provider as AdultMetadataSource] : (provider as string[]).map((p) => p as AdultMetadataSource))
      : undefined;

    const results = await metadataAggregator.searchScenes({
      query,
      providers,
      category: category as any,
      performerName: performer as string,
      studioName: studio as string,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    return res.status(200).json(results);
  } catch (e) {
    logger.error('Adult metadata scene search failed', {
      label: 'AdultMetadata',
      errorMessage: e.message,
    });
    return next({ status: 500, message: 'Scene search failed.' });
  }
});

/**
 * GET /adult-metadata/search/performers
 * Search performers across enabled providers.
 */
router.get('/search/performers', async (req, res, next) => {
  try {
    const { query, provider, page, pageSize } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    const allResults: any[] = [];
    const providerStr = (provider as string)?.toLowerCase();

    // Query individual providers
    const promises: Promise<void>[] = [];

    if (!providerStr || providerStr === AdultMetadataSource.TPDB) {
      promises.push(
        new ThePornDB().searchPerformers(query, {
          page: page ? Number(page) : 1,
          pageSize: pageSize ? Number(pageSize) : 25,
        }).then((r) => allResults.push(...r.performers.map((p: any) => ({ ...p, provider: AdultMetadataSource.TPDB }))))
        .catch(() => {})
      );
    }

    if (!providerStr || providerStr === AdultMetadataSource.R18) {
      promises.push(
        new R18API().searchActresses(query, {
          page: page ? Number(page) : 1,
          pageSize: pageSize ? Number(pageSize) : 25,
        }).then((r) => allResults.push(...r.actresses.map((p: any) => ({ ...p, provider: AdultMetadataSource.R18 }))))
        .catch(() => {})
      );
    }

    await Promise.allSettled(promises);

    // Cross-reference and deduplicate
    const identity = PerformerCrossReference.buildIdentity(allResults, query as string);

    return res.status(200).json({
      results: allResults,
      identity,
      total: allResults.length,
      page: page ? Number(page) : 1,
    });
  } catch (e) {
    logger.error('Adult metadata performer search failed', {
      label: 'AdultMetadata',
      errorMessage: e.message,
    });
    return next({ status: 500, message: 'Performer search failed.' });
  }
});

/**
 * GET /adult-metadata/scene/:source/:id
 * Get aggregated scene metadata by provider source and ID.
 */
router.get('/scene/:source/:id', async (req, res, next) => {
  try {
    const { source, id } = req.params;
    const providerSource = source as AdultMetadataSource;

    if (!Object.values(AdultMetadataSource).includes(providerSource)) {
      return res.status(400).json({ error: `Unknown provider source: ${source}` });
    }

    const result = await metadataAggregator.getAggregatedScene(id, providerSource);

    if (!result) {
      return next({ status: 404, message: 'Scene not found in any provider.' });
    }

    return res.status(200).json(result);
  } catch (e) {
    logger.error('Failed to get aggregated scene', {
      label: 'AdultMetadata',
      errorMessage: e.message,
    });
    return next({ status: 500, message: 'Failed to retrieve scene metadata.' });
  }
});

/**
 * GET /adult-metadata/performer/:source/:id
 * Get aggregated performer metadata.
 */
router.get('/performer/:source/:id', async (req, res, next) => {
  try {
    const { source, id } = req.params;
    const providerSource = source as AdultMetadataSource;

    let performerResult;

    switch (providerSource) {
      case AdultMetadataSource.TPDB:
        performerResult = await new ThePornDB().getPerformer(id);
        break;
      case AdultMetadataSource.R18:
        performerResult = await new R18API().getActress(id);
        break;
      default:
        return res.status(400).json({ error: `Unsupported source for performer lookup: ${source}` });
    }

    // Cross-reference against other providers
    const identity = await PerformerCrossReference.crossReferencePerformer(
      performerResult.name,
      performerResult.source,
      []
    );

    return res.status(200).json({
      performer: performerResult,
      identity,
    });
  } catch (e) {
    logger.error('Failed to get performer metadata', {
      label: 'AdultMetadata',
      errorMessage: e.message,
    });
    return next({ status: 500, message: 'Failed to retrieve performer metadata.' });
  }
});

/**
 * GET /adult-metadata/studio/:source/:id
 * Get studio metadata by provider.
 */
router.get('/studio/:source/:id', async (req, res, next) => {
  try {
    const { source, id } = req.params;

    let studio;

    switch (source) {
      case AdultMetadataSource.TPDB:
        studio = await new ThePornDB().getStudio(id);
        break;
      case AdultMetadataSource.R18:
        studio = await new R18API().getStudio(id);
        break;
      case AdultMetadataSource.ADULT_DVD_EMPIRE:
        studio = await new AdultDVDEmpireAPI().getStudio(id);
        break;
      default:
        return res.status(400).json({ error: `Unsupported source: ${source}` });
    }

    return res.status(200).json(studio);
  } catch (e) {
    return next({ status: 500, message: 'Failed to retrieve studio metadata.' });
  }
});

/**
 * GET /adult-metadata/cross-reference/performer/:id
 * Cross-reference a Voyeurr performer against all metadata providers.
 */
router.get('/cross-reference/performer/:id', async (req, res, next) => {
  try {
    const performerId = Number(req.params.id);
    const identity = await PerformerCrossReference.findPerformerCrossReferences(performerId);

    if (!identity) {
      return next({ status: 404, message: 'Performer not found.' });
    }

    return res.status(200).json(identity);
  } catch (e) {
    return next({ status: 500, message: 'Failed to cross-reference performer.' });
  }
});

/**
 * POST /adult-metadata/cross-reference/performer/:id
 * Trigger full cross-reference lookup for a performer.
 */
router.post('/cross-reference/performer/:id', async (req, res, next) => {
  try {
    const performerRepository = getRepository(Performer);
    const performer = await performerRepository.findOne({
      where: { id: Number(req.params.id) },
    });

    if (!performer) {
      return next({ status: 404, message: 'Performer not found.' });
    }

    // Search across providers
    const identity = await metadataAggregator.getAggregatedPerformer(performer.name);

    if (!identity) {
      return res.status(200).json({
        message: 'No cross-references found for this performer.',
        performer: { id: performer.id, name: performer.name },
      });
    }

    // Update performer with cross-referenced external IDs
    const existingExternalIds = performer.externalIds ? JSON.parse(performer.externalIds) : {};
    const mergedExternalIds = { ...existingExternalIds, ...identity.externalIds };

    performer.externalIds = JSON.stringify(mergedExternalIds);
    if (identity.aliases.length) {
      performer.aliases = JSON.stringify(identity.aliases);
    }
    await performerRepository.save(performer);

    return res.status(200).json({
      message: 'Performer cross-referenced successfully.',
      performer: { id: performer.id, name: performer.name },
      identity,
    });
  } catch (e) {
    logger.error('Failed to cross-reference performer', {
      label: 'AdultMetadata',
      errorMessage: e.message,
    });
    return next({ status: 500, message: 'Failed to cross-reference performer.' });
  }
});

/**
 * POST /adult-metadata/refresh/:type
 * Trigger a metadata refresh for scenes, performers, or studios.
 */
router.post('/refresh/:type', async (req, res, next) => {
  try {
    const { type } = req.params;

    if (!['scenes', 'performers', 'studios', 'all'].includes(type)) {
      return res.status(400).json({ error: 'Type must be: scenes, performers, studios, or all' });
    }

    // Run async — respond immediately
    res.status(200).json({ message: `Metadata refresh for '${type}' started.` });

    switch (type) {
      case 'scenes':
        await adultScanner.refreshScenes();
        break;
      case 'performers':
        await adultScanner.refreshPerformers();
        break;
      case 'studios':
        await adultScanner.refreshStudios();
        break;
      case 'all':
        await adultScanner.refreshAll();
        break;
    }
  } catch (e) {
    logger.error('Metadata refresh failed', {
      label: 'AdultMetadata',
      errorMessage: e.message,
    });
    // Response already sent, just log
  }
});

/**
 * GET /adult-metadata/cache/stats
 * Get metadata cache statistics.
 */
router.get('/cache/stats', (_req, res) => {
  const providers = metadataAggregator.getEnabledProviders();
  return res.status(200).json({
    enabledProviders: providers,
    providerCount: providers.length,
    lastRefresh: adultScanner.lastRefresh,
    isRefreshing: adultScanner.isRefreshing,
  });
});

export default router;
