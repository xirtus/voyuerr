import { getRepository } from '@server/datasource';
import Scene from '@server/entity/Scene';
import Studio from '@server/entity/Studio';
import { mapSceneDetails } from '@server/models/Scene';
import { Router } from 'express';

const router = Router();

/**
 * GET /studio/:id — Get studio by database ID.
 */
router.get<{ id: string }>('/:id', async (req, res, next) => {
  const studioRepository = getRepository(Studio);

  try {
    const studio = await studioRepository.findOne({
      where: { id: Number(req.params.id) },
      relations: ['parentStudio', 'childStudios'],
    });

    if (!studio) {
      return next({ status: 404, message: 'Studio not found.' });
    }

    return res.status(200).json({
      id: studio.id,
      name: studio.name,
      slug: studio.slug,
      description: studio.description,
      logoUrl: studio.logoUrl,
      backdropUrl: studio.backdropUrl,
      websiteUrl: studio.websiteUrl,
      networkType: studio.networkType,
      country: studio.country,
      foundedYear: studio.foundedYear,
      sceneCount: studio.sceneCount,
      popularity: studio.popularity,
      externalIds: studio.externalIds ? JSON.parse(studio.externalIds) : {},
      parentStudio: studio.parentStudio
        ? {
            id: studio.parentStudio.id,
            name: studio.parentStudio.name,
            slug: studio.parentStudio.slug,
            logoUrl: studio.parentStudio.logoUrl,
          }
        : null,
      childStudios: studio.childStudios
        ? studio.childStudios.map((child) => ({
            id: child.id,
            name: child.name,
            slug: child.slug,
            logoUrl: child.logoUrl,
          }))
        : [],
    });
  } catch (e) {
    return next({
      status: 500,
      message: 'Unable to retrieve studio.',
    });
  }
});

/**
 * GET /studio/slug/:slug — Get studio by URL slug.
 */
router.get<{ slug: string }>('/slug/:slug', async (req, res, next) => {
  const studioRepository = getRepository(Studio);

  try {
    const studio = await studioRepository.findOne({
      where: { slug: req.params.slug },
      relations: ['parentStudio', 'childStudios'],
    });

    if (!studio) {
      return next({ status: 404, message: 'Studio not found.' });
    }

    return res.status(200).json({
      id: studio.id,
      name: studio.name,
      slug: studio.slug,
      description: studio.description,
      logoUrl: studio.logoUrl,
      backdropUrl: studio.backdropUrl,
      websiteUrl: studio.websiteUrl,
      networkType: studio.networkType,
      country: studio.country,
      foundedYear: studio.foundedYear,
      sceneCount: studio.sceneCount,
      popularity: studio.popularity,
      externalIds: studio.externalIds ? JSON.parse(studio.externalIds) : {},
      parentStudio: studio.parentStudio
        ? {
            id: studio.parentStudio.id,
            name: studio.parentStudio.name,
            slug: studio.parentStudio.slug,
            logoUrl: studio.parentStudio.logoUrl,
          }
        : null,
      childStudios: studio.childStudios
        ? studio.childStudios.map((child) => ({
            id: child.id,
            name: child.name,
            slug: child.slug,
            logoUrl: child.logoUrl,
          }))
        : [],
    });
  } catch (e) {
    return next({
      status: 500,
      message: 'Unable to retrieve studio.',
    });
  }
});

/**
 * GET /studio/:id/scenes — Get all scenes for a studio.
 */
router.get<{ id: string }>('/:id/scenes', async (req, res, next) => {
  const sceneRepository = getRepository(Scene);

  try {
    const scenes = await sceneRepository.find({
      where: { studioId: Number(req.params.id) },
      relations: ['studio', 'scenePerformers', 'scenePerformers.performer'],
      order: { releaseDate: 'DESC' },
      take: 100,
    });

    return res.status(200).json(scenes.map(mapSceneDetails));
  } catch (e) {
    return next({
      status: 500,
      message: 'Unable to retrieve studio scenes.',
    });
  }
});

export default router;
