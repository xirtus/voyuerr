import type {
  ContentCategory,
  ContentType,
  PerformerRole,
} from '@server/constants/content';
import type { SceneStatus } from '@server/constants/content';
import type Media from '@server/entity/Media';
import type SceneEntity from '@server/entity/Scene';

export interface SceneExternalIds {
  tpdb?: string;
  r18?: string;
  javdb?: string;
  stashdb?: string;
  imdb?: string;
  adultdvrempire?: string;
}

export interface ScenePerformerInfo {
  id: number;
  name: string;
  role: PerformerRole;
  sortOrder: number;
  characterName?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface StudioInfo {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  networkType: string;
}

export interface SceneDetails {
  id: number;
  contentType: ContentType;
  title: string;
  originalTitle?: string;
  releaseDate?: string;
  releaseYear?: number;
  runtime?: number;
  description?: string;
  externalId: string;
  externalSource: string;
  externalIds?: SceneExternalIds;
  categories: ContentCategory[];
  tags: string[];
  posterUrl?: string;
  backdropUrl?: string;
  trailerUrl?: string;
  status: SceneStatus;
  status4k: SceneStatus;
  studio?: StudioInfo;
  performers: ScenePerformerInfo[];
  mediaInfo?: Media;
  mediaUrl?: string;
  mediaUrl4k?: string;
  serviceUrl?: string;
  serviceUrl4k?: string;
}

export const mapSceneDetails = (
  scene: SceneEntity,
  media?: Media
): SceneDetails => ({
  id: scene.id,
  contentType: scene.contentType,
  title: scene.title,
  originalTitle: scene.originalTitle,
  releaseDate: scene.releaseDate,
  releaseYear: scene.releaseYear,
  runtime: scene.runtime,
  description: scene.description,
  externalId: scene.externalId,
  externalSource: scene.externalSource,
  externalIds: scene.externalIds
    ? JSON.parse(scene.externalIds)
    : undefined,
  categories: scene.categoryList,
  tags: scene.tagList,
  posterUrl: scene.posterUrl,
  backdropUrl: scene.backdropUrl,
  trailerUrl: scene.trailerUrl,
  status: scene.status,
  status4k: scene.status4k,
  studio: scene.studio
    ? {
        id: scene.studio.id,
        name: scene.studio.name,
        slug: scene.studio.slug,
        logoUrl: scene.studio.logoUrl,
        networkType: scene.studio.networkType,
      }
    : undefined,
  performers: scene.performers.map((sp) => ({
    id: sp.performer.id,
    name: sp.performer.name,
    role: sp.role,
    sortOrder: sp.sortOrder,
    characterName: sp.characterName,
    imageUrl: sp.performer.imageUrl,
    thumbnailUrl: sp.performer.thumbnailUrl,
  })),
  mediaInfo: media,
});
