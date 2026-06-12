import { getRepository } from '@server/datasource';
import Performer from '@server/entity/Performer';
import ScenePerformer from '@server/entity/ScenePerformer';
import { mapSceneDetails } from '@server/models/Scene';
import { Router } from 'express';

const router = Router();

/**
 * GET /performer/:id — Retrieve a performer by database ID.
 */
router.get<{ id: string }>('/:id', async (req, res, next) => {
  const performerRepository = getRepository(Performer);

  try {
    const performer = await performerRepository.findOne({
      where: { id: Number(req.params.id) },
    });

    if (!performer) {
      return next({ status: 404, message: 'Performer not found.' });
    }

    return res.status(200).json({
      id: performer.id,
      name: performer.name,
      aliases: performer.aliases ? JSON.parse(performer.aliases) : [],
      birthDate: performer.birthDate,
      bio: performer.bio,
      gender: performer.gender,
      imageUrl: performer.imageUrl,
      thumbnailUrl: performer.thumbnailUrl,
      country: performer.country,
      height: performer.height,
      weight: performer.weight,
      measurements: performer.measurements,
      sceneCount: performer.sceneCount,
      active: performer.active,
      adult: performer.adult,
      popularity: performer.popularity,
      externalIds: performer.externalIds
        ? JSON.parse(performer.externalIds)
        : {},
    });
  } catch (e) {
    return next({
      status: 500,
      message: 'Unable to retrieve performer.',
    });
  }
});

/**
 * GET /performer/:id/scenes — Get all scenes for a performer.
 */
router.get<{ id: string }>('/:id/scenes', async (req, res, next) => {
  const scenePerformerRepository = getRepository(ScenePerformer);

  try {
    const appearances = await scenePerformerRepository.find({
      where: { performerId: Number(req.params.id) },
      relations: [
        'scene',
        'scene.studio',
        'scene.scenePerformers',
        'scene.scenePerformers.performer',
      ],
      order: { sortOrder: 'ASC' },
    });

    const scenes = appearances.map((sp) => ({
      ...mapSceneDetails(sp.scene),
      performerRole: sp.role,
      characterName: sp.characterName,
    }));

    return res.status(200).json(scenes);
  } catch (e) {
    return next({
      status: 500,
      message: 'Unable to retrieve performer scenes.',
    });
  }
});

export default router;
