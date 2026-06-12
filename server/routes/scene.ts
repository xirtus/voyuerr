import { getRepository } from '@server/datasource';
import Scene from '@server/entity/Scene';
import Media from '@server/entity/Media';
import { mapSceneDetails } from '@server/models/Scene';
import { MediaServerType } from '@server/constants/server';
import { getSettings } from '@server/lib/settings';
import { Router } from 'express';

const router = Router();

function getMediaUrl(jellyfinMediaId?: string, ratingKey?: string, is4k = false): string | undefined {
  const settings = getSettings();

  if (settings.main.mediaServerType === MediaServerType.JELLYFIN && jellyfinMediaId) {
    const proto = settings.jellyfin.useSsl ? 'https' : 'http';
    const port = settings.jellyfin.port;
    const base = settings.jellyfin.externalHostname || settings.jellyfin.ip;
    return `${proto}://${base}:${port}/web/index.html#!/details?id=${jellyfinMediaId}`;
  }

  if (settings.main.mediaServerType === MediaServerType.PLEX && ratingKey) {
    const webAppUrl = settings.plex.webAppUrl || 'https://app.plex.tv';
    return `${webAppUrl}/desktop/#!/server/${settings.plex.machineId}/details?key=%2Flibrary%2Fmetadata%2F${ratingKey}`;
  }

  if (settings.main.mediaServerType === MediaServerType.EMBY && jellyfinMediaId) {
    const proto = settings.jellyfin.useSsl ? 'https' : 'http';
    const port = settings.jellyfin.port;
    const base = settings.jellyfin.externalHostname || settings.jellyfin.ip;
    return `${proto}://${base}:${port}/web/index.html#!/item?id=${jellyfinMediaId}`;
  }

  return undefined;
}

/**
 * GET /scene/:id — Retrieve a single scene by its database ID.
 */
router.get<{ id: string }>('/:id', async (req, res, next) => {
  const sceneRepository = getRepository(Scene);

  try {
    const scene = await sceneRepository.findOne({
      where: { id: Number(req.params.id) },
      relations: ['studio', 'scenePerformers', 'scenePerformers.performer'],
    });

    if (!scene) {
      return next({
        status: 404,
        message: 'Scene not found.',
      });
    }

    const details = mapSceneDetails(scene);

    // Compute media playback URLs
    if (scene.jellyfinMediaId || scene.ratingKey) {
      details.mediaUrl = getMediaUrl(scene.jellyfinMediaId ?? undefined, scene.ratingKey ?? undefined, false);
    }
    if (scene.jellyfinMediaId4k || scene.ratingKey4k) {
      details.mediaUrl4k = getMediaUrl(scene.jellyfinMediaId4k ?? undefined, scene.ratingKey4k ?? undefined, true);
    }

    return res.status(200).json(details);
  } catch (e) {
    return next({
      status: 500,
      message: 'Unable to retrieve scene.',
    });
  }
});

/**
 * GET /scene/external/:source/:id — Look up a scene by external provider ID.
 */
router.get<{ source: string; id: string }>(
  '/external/:source/:id',
  async (req, res, next) => {
    const sceneRepository = getRepository(Scene);

    try {
      const scene = await sceneRepository.findOne({
        where: {
          externalSource: req.params.source,
          externalId: req.params.id,
        },
        relations: ['studio', 'scenePerformers', 'scenePerformers.performer'],
      });

      if (!scene) {
        return next({
          status: 404,
          message: 'Scene not found for this external source.',
        });
      }

      const details = mapSceneDetails(scene);

      if (scene.jellyfinMediaId || scene.ratingKey) {
        details.mediaUrl = getMediaUrl(scene.jellyfinMediaId ?? undefined, scene.ratingKey ?? undefined, false);
      }
      if (scene.jellyfinMediaId4k || scene.ratingKey4k) {
        details.mediaUrl4k = getMediaUrl(scene.jellyfinMediaId4k ?? undefined, scene.ratingKey4k ?? undefined, true);
      }

      return res.status(200).json(details);
    } catch (e) {
      return next({
        status: 500,
        message: 'Unable to retrieve scene.',
      });
    }
  }
);

export default router;
