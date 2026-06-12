/**
 * Voyeurr Engagement Engine — Phase 10
 * Ratings, reviews, favorites, collections, watch history.
 */
import { getRepository } from '@server/datasource';
import Scene from '@server/entity/Scene';
import Rating from '@server/entity/Rating';
import Review from '@server/entity/Review';
import Favorite from '@server/entity/Favorite';
import UserCollection from '@server/entity/UserCollection';
import WatchHistory from '@server/entity/WatchHistory';
import User from '@server/entity/User';
import logger from '@server/logger';

export class EngagementEngine {
  // --- Ratings ---
  async rateScene(userId: number, sceneId: number, score: number) {
    if (score < 1 || score > 5) throw new Error('Score must be 1–5');
    const repo = getRepository(Rating);
    let rating = await repo.findOne({ where: { userId, sceneId } });
    if (rating) { rating.score = score; } else { rating = new Rating({ userId, sceneId, score }); }
    return repo.save(rating);
  }

  async getSceneRatings(sceneId: number) {
    const repo = getRepository(Rating);
    const [ratings, count] = await repo.findAndCount({ where: { sceneId } });
    const avg = ratings.length ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length : 0;
    return { average: Math.round(avg * 10) / 10, count, distribution: [1,2,3,4,5].map(s => ratings.filter(r => r.score === s).length) };
  }

  async getUserRatings(userId: number, page = 1, pageSize = 25) {
    return getRepository(Rating).find({ where: { userId }, order: { updatedAt: 'DESC' }, skip: (page-1)*pageSize, take: pageSize });
  }

  // --- Reviews ---
  async createReview(userId: number, sceneId: number, body: string, hasSpoilers = false) {
    const repo = getRepository(Review);
    const existing = await repo.findOne({ where: { userId, sceneId } });
    if (existing) throw new Error('Review already exists');
    return repo.save(new Review({ userId, sceneId, body, hasSpoilers }));
  }

  async getSceneReviews(sceneId: number, page = 1, pageSize = 10) {
    const repo = getRepository(Review);
    return repo.find({ where: { sceneId }, relations: ['user'], order: { createdAt: 'DESC' }, skip: (page-1)*pageSize, take: pageSize });
  }

  async deleteReview(userId: number, reviewId: number) {
    const repo = getRepository(Review);
    const review = await repo.findOne({ where: { id: reviewId, userId } });
    if (!review) throw new Error('Review not found');
    return repo.remove(review);
  }

  // --- Favorites ---
  async toggleFavorite(userId: number, entityType: string, entityId: number) {
    const repo = getRepository(Favorite);
    const existing = await repo.findOne({ where: { userId, entityType, entityId } });
    if (existing) { await repo.remove(existing); return { favorited: false }; }
    await repo.save(new Favorite({ userId, entityType, entityId }));
    return { favorited: true };
  }

  async getUserFavorites(userId: number, entityType?: string) {
    const where: any = { userId };
    if (entityType) where.entityType = entityType;
    return getRepository(Favorite).find({ where, order: { createdAt: 'DESC' } });
  }

  // --- Collections ---
  async createCollection(userId: number, name: string, description?: string, isPublic = false) {
    return getRepository(UserCollection).save(new UserCollection({ userId, name, description, isPublic, sceneIds: '[]' }));
  }

  async addToCollection(collectionId: number, userId: number, sceneId: number) {
    const repo = getRepository(UserCollection);
    const col = await repo.findOne({ where: { id: collectionId, userId } });
    if (!col) throw new Error('Collection not found');
    const ids: number[] = col.sceneIds ? JSON.parse(col.sceneIds) : [];
    if (!ids.includes(sceneId)) { ids.push(sceneId); col.sceneIds = JSON.stringify(ids); }
    return repo.save(col);
  }

  async removeFromCollection(collectionId: number, userId: number, sceneId: number) {
    const repo = getRepository(UserCollection);
    const col = await repo.findOne({ where: { id: collectionId, userId } });
    if (!col) throw new Error('Collection not found');
    const ids: number[] = col.sceneIds ? JSON.parse(col.sceneIds) : [];
    col.sceneIds = JSON.stringify(ids.filter(id => id !== sceneId));
    return repo.save(col);
  }

  async getUserCollections(userId: number) {
    return getRepository(UserCollection).find({ where: { userId }, order: { updatedAt: 'DESC' } });
  }

  async getPublicCollections(page = 1, pageSize = 20) {
    const repo = getRepository(UserCollection);
    return repo.find({ where: { isPublic: true }, relations: ['user'], order: { followerCount: 'DESC' }, skip: (page-1)*pageSize, take: pageSize });
  }

  // --- Watch History ---
  async markWatched(userId: number, sceneId: number, resumePosition?: number) {
    const repo = getRepository(WatchHistory);
    let wh = await repo.findOne({ where: { userId, sceneId } });
    if (!wh) wh = new WatchHistory({ userId, sceneId });
    wh.watched = true;
    wh.lastWatchedAt = new Date();
    if (resumePosition !== undefined) wh.resumePosition = resumePosition;
    else wh.playCount += 1;
    return repo.save(wh);
  }

  async getWatchHistory(userId: number, page = 1, pageSize = 25) {
    const repo = getRepository(WatchHistory);
    return repo.find({ where: { userId, watched: true }, order: { lastWatchedAt: 'DESC' }, skip: (page-1)*pageSize, take: pageSize });
  }

  /** Personalized home page: mix of watch history performers, highly rated, recent. */
  async getPersonalizedFeed(userId: number, limit = 24) {
    const sceneRepo = getRepository(Scene);
    const watchRepo = getRepository(WatchHistory);
    const ratingRepo = getRepository(Rating);

    const recentWatches = await watchRepo.find({ where: { userId }, order: { lastWatchedAt: 'DESC' }, take: 20 });
    const watchedSceneIds = recentWatches.map(w => w.sceneId);
    const highRatings = await ratingRepo.find({ where: { userId }, order: { score: 'DESC' }, take: 20 });
    const highRatedSceneIds = highRatings.map(r => r.sceneId);

    // Get performers from watched/rated scenes
    const allSceneIds = [...new Set([...watchedSceneIds, ...highRatedSceneIds])];
    if (!allSceneIds.length) {
      return sceneRepo.find({ relations: ['studio'], order: { releaseDate: 'DESC' }, take: limit });
    }

    const scenes = await sceneRepo.findByIds(allSceneIds, { relations: ['scenePerformers'] });
    const performerIds = new Set(scenes.flatMap(s => s.performers?.map(sp => sp.performerId) ?? []));

    // Recommend scenes with same performers, not yet watched
    if (performerIds.size === 0) {
      return sceneRepo.find({ relations: ['studio'], order: { releaseDate: 'DESC' }, take: limit });
    }

    return sceneRepo.createQueryBuilder('Scene')
      .leftJoinAndSelect('Scene.studio', 'studio')
      .leftJoinAndSelect('Scene.scenePerformers', 'sp')
      .leftJoinAndSelect('sp.performer', 'performer')
      .where('sp.performerId IN (:...pids)', { pids: [...performerIds].slice(0, 50) })
      .andWhere(watchedSceneIds.length ? 'Scene.id NOT IN (:...wids)' : '1=1', { wids: watchedSceneIds })
      .orderBy('Scene.releaseDate', 'DESC')
      .take(limit).getMany();
  }
}

export const engagementEngine = new EngagementEngine();
export default engagementEngine;
