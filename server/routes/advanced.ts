/**
 * Advanced Routes — Phases 9-13 combined
 * Search, engagement, automation, social, analytics endpoints.
 */
import { getRepository } from '@server/datasource';
import SavedSearch from '@server/entity/SavedSearch';
import Rating from '@server/entity/Rating';
import Review from '@server/entity/Review';
import Favorite from '@server/entity/Favorite';
import UserCollection from '@server/entity/UserCollection';
import WatchHistory from '@server/entity/WatchHistory';
import AutoApproveRule from '@server/entity/AutoApproveRule';
import ActivityFeed from '@server/entity/ActivityFeed';
import UserFollow from '@server/entity/UserFollow';
import Comment from '@server/entity/Comment';
import AnalyticsEvent from '@server/entity/AnalyticsEvent';
import { searchEngine } from '@server/lib/searchEngine';
import { engagementEngine } from '@server/lib/engagementEngine';
import { automationEngine } from '@server/lib/automationEngine';
import { socialEngine } from '@server/lib/socialEngine';
import { analyticsEngine } from '@server/lib/analyticsEngine';
import { Permission } from '@server/lib/permissions';
import { isAuthenticated } from '@server/middleware/auth';
import logger from '@server/logger';
import { Router } from 'express';

const router = Router();
router.use(isAuthenticated());

// ═══════════════════ PHASE 9 — SEARCH ═══════════════════

router.get('/search/advanced', async (req, res, next) => {
  try {
    const result = await searchEngine.search({
      query: (req.query.query as string) ?? '',
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 25,
      sort: (req.query.sort as any) || 'relevance',
      facets: req.query.facets ? JSON.parse(req.query.facets as string) : undefined,
    });
    res.json(result);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.get('/search/autocomplete', async (req, res, next) => {
  try {
    const result = await searchEngine.autocomplete((req.query.q as string) ?? '');
    res.json(result);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.get('/search/trending', async (req, res, next) => {
  try {
    const result = await searchEngine.getTrending({
      window: (req.query.window as any) ?? 'week',
      category: req.query.category as string,
      limit: Number(req.query.limit) || 24,
    });
    res.json(result);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.get('/search/similar/:sceneId', async (req, res, next) => {
  try {
    const result = await searchEngine.findSimilar({
      sceneId: Number(req.params.sceneId),
      count: Number(req.query.count) || 12,
    });
    res.json(result);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.get('/search/more-like-this/:type/:id', async (req, res, next) => {
  try {
    const result = await searchEngine.moreLikeThis(
      req.params.type as any,
      Number(req.params.id),
      Number(req.query.limit) || 12
    );
    res.json(result);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.get('/search/saved', async (req, res, next) => {
  try {
    const searches = await getRepository(SavedSearch).find({ where: { userId: req.user!.id } });
    res.json(searches);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.post('/search/saved', async (req, res, next) => {
  try {
    const search = await getRepository(SavedSearch).save(new SavedSearch({
      userId: req.user!.id,
      name: req.body.name,
      query: JSON.stringify(req.body.query),
      isDefault: req.body.isDefault ?? false,
    }));
    res.json(search);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.delete('/search/saved/:id', async (req, res, next) => {
  try {
    await getRepository(SavedSearch).delete({ id: Number(req.params.id), userId: req.user!.id });
    res.json({ deleted: true });
  } catch (e) { next({ status: 500, message: e.message }); }
});

// ═══════════════════ PHASE 10 — ENGAGEMENT ═══════════════════

// Ratings
router.post('/rating/:sceneId', async (req, res, next) => {
  try { res.json(await engagementEngine.rateScene(req.user!.id, Number(req.params.sceneId), req.body.score)); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.get('/rating/:sceneId', async (req, res, next) => {
  try { res.json(await engagementEngine.getSceneRatings(Number(req.params.sceneId))); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.get('/ratings/me', async (req, res, next) => {
  try { res.json(await engagementEngine.getUserRatings(req.user!.id)); }
  catch (e) { next({ status: 500, message: e.message }); }
});

// Reviews
router.post('/review/:sceneId', async (req, res, next) => {
  try { res.json(await engagementEngine.createReview(req.user!.id, Number(req.params.sceneId), req.body.body, req.body.hasSpoilers)); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.get('/review/:sceneId', async (req, res, next) => {
  try { res.json(await engagementEngine.getSceneReviews(Number(req.params.sceneId))); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.delete('/review/:id', async (req, res, next) => {
  try { res.json(await engagementEngine.deleteReview(req.user!.id, Number(req.params.id))); }
  catch (e) { next({ status: 400, message: e.message }); }
});

// Favorites
router.post('/favorite', async (req, res, next) => {
  try { res.json(await engagementEngine.toggleFavorite(req.user!.id, req.body.entityType, req.body.entityId)); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.get('/favorites', async (req, res, next) => {
  try { res.json(await engagementEngine.getUserFavorites(req.user!.id, req.query.type as string)); }
  catch (e) { next({ status: 500, message: e.message }); }
});

// Collections
router.post('/collection', async (req, res, next) => {
  try { res.json(await engagementEngine.createCollection(req.user!.id, req.body.name, req.body.description, req.body.isPublic)); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.get('/collections', async (req, res, next) => {
  try { res.json(await engagementEngine.getUserCollections(req.user!.id)); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.get('/collections/public', async (req, res, next) => {
  try { res.json(await engagementEngine.getPublicCollections()); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.post('/collection/:id/add', async (req, res, next) => {
  try { res.json(await engagementEngine.addToCollection(Number(req.params.id), req.user!.id, req.body.sceneId)); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.post('/collection/:id/remove', async (req, res, next) => {
  try { res.json(await engagementEngine.removeFromCollection(Number(req.params.id), req.user!.id, req.body.sceneId)); }
  catch (e) { next({ status: 400, message: e.message }); }
});

// Watch History
router.post('/watch/:sceneId', async (req, res, next) => {
  try { res.json(await engagementEngine.markWatched(req.user!.id, Number(req.params.sceneId), req.body.resumePosition)); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.get('/watch/history', async (req, res, next) => {
  try { res.json(await engagementEngine.getWatchHistory(req.user!.id)); }
  catch (e) { next({ status: 500, message: e.message }); }
});

// Personalized Feed
router.get('/feed/personalized', async (req, res, next) => {
  try { res.json(await engagementEngine.getPersonalizedFeed(req.user!.id)); }
  catch (e) { next({ status: 500, message: e.message }); }
});

// ═══════════════════ PHASE 11 — AUTOMATION ═══════════════════

router.get('/automation/rules', isAuthenticated(Permission.ADMIN), async (_req, res, next) => {
  try { res.json(await getRepository(AutoApproveRule).find()); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.post('/automation/rules', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  try { res.json(await getRepository(AutoApproveRule).save(new AutoApproveRule(req.body))); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.put('/automation/rules/:id', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  try {
    const repo = getRepository(AutoApproveRule);
    const rule = await repo.findOne({ where: { id: Number(req.params.id) } });
    if (!rule) return next({ status: 404, message: 'Rule not found' });
    Object.assign(rule, req.body);
    res.json(await repo.save(rule));
  } catch (e) { next({ status: 400, message: e.message }); }
});
router.delete('/automation/rules/:id', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  try { await getRepository(AutoApproveRule).delete(Number(req.params.id)); res.json({ deleted: true }); }
  catch (e) { next({ status: 500, message: e.message }); }
});

router.post('/automation/check-duplicate', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  try { res.json(await automationEngine.detectDuplicate(req.body.title, req.body.studioId, req.body.releaseYear)); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.post('/automation/retry', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  try { await automationEngine.processRetries(); res.json({ processed: true }); }
  catch (e) { next({ status: 500, message: e.message }); }
});

// ═══════════════════ PHASE 12 — SOCIAL ═══════════════════

router.get('/social/feed', async (req, res, next) => {
  try { res.json(req.query.global ? await socialEngine.getGlobalFeed() : await socialEngine.getFeed(req.user!.id)); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.post('/social/follow/:userId', async (req, res, next) => {
  try { res.json(await socialEngine.followUser(req.user!.id, Number(req.params.userId))); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.delete('/social/follow/:userId', async (req, res, next) => {
  try { res.json(await socialEngine.unfollowUser(req.user!.id, Number(req.params.userId))); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.get('/social/followers/:userId', async (req, res, next) => {
  try { res.json(await socialEngine.getFollowers(Number(req.params.userId))); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.get('/social/following/:userId', async (req, res, next) => {
  try { res.json(await socialEngine.getFollowing(Number(req.params.userId))); }
  catch (e) { next({ status: 500, message: e.message }); }
});

// Comments
router.post('/comment/:sceneId', async (req, res, next) => {
  try { res.json(await socialEngine.addComment(req.user!.id, Number(req.params.sceneId), req.body.body, req.body.parentId)); }
  catch (e) { next({ status: 400, message: e.message }); }
});
router.get('/comment/:sceneId', async (req, res, next) => {
  try { res.json(await socialEngine.getSceneComments(Number(req.params.sceneId))); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.post('/comment/:id/vote', async (req, res, next) => {
  try { res.json(await socialEngine.voteComment(Number(req.params.id), req.body.direction)); }
  catch (e) { next({ status: 400, message: e.message }); }
});

// Request voting
router.post('/request/:id/vote', async (req, res, next) => {
  try { res.json(await socialEngine.voteRequest(Number(req.params.id), req.user!.id)); }
  catch (e) { next({ status: 400, message: e.message }); }
});

// User profile
router.get('/social/profile/:userId', async (req, res, next) => {
  try { res.json(await socialEngine.getUserProfile(Number(req.params.userId))); }
  catch (e) { next({ status: 500, message: e.message }); }
});

// Group watch
router.post('/social/groupwatch', async (req, res, next) => {
  try { res.json(await socialEngine.createGroupWatch(req.user!.id, req.body.sceneId, req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined)); }
  catch (e) { next({ status: 400, message: e.message }); }
});

// ═══════════════════ PHASE 13 — ANALYTICS ═══════════════════

router.get('/analytics/dashboard', isAuthenticated(Permission.ADMIN), async (_req, res, next) => {
  try { res.json(await analyticsEngine.getDashboardMetrics()); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.get('/analytics/content', isAuthenticated(Permission.ADMIN), async (_req, res, next) => {
  try { res.json(await analyticsEngine.getContentAnalytics()); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.get('/analytics/storage', isAuthenticated(Permission.ADMIN), async (_req, res, next) => {
  try { res.json(await analyticsEngine.getStorageForecast()); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.get('/analytics/health', isAuthenticated(Permission.ADMIN), async (_req, res, next) => {
  try { res.json(await analyticsEngine.getSystemHealth()); }
  catch (e) { next({ status: 500, message: e.message }); }
});
router.get('/analytics/export/:type', isAuthenticated(Permission.ADMIN), async (req, res, next) => {
  try {
    const data = await analyticsEngine.exportData(req.params.type);
    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${req.params.type}.csv`);
      res.send(typeof data === 'object' ? Object.entries(data).map(([k, v]) => `${k},${JSON.stringify(v)}`).join('\n') : '');
    } else {
      res.json(data);
    }
  } catch (e) { next({ status: 400, message: e.message }); }
});

// Track event (anonymized, opt-in)
router.post('/analytics/event', async (req, res, next) => {
  try {
    await analyticsEngine.trackEvent(req.body.eventType, req.body.payload ?? {}, req.user?.id?.toString() ?? 'anon');
    res.json({ tracked: true });
  } catch (e) { next({ status: 500, message: e.message }); }
});

export default router;
