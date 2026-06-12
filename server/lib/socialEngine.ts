/**
 * Voyeurr Social Engine — Phase 12
 * Activity feeds, user follows, comments, collaborative curation,
 * request voting, group watch coordination.
 */
import { getRepository } from '@server/datasource';
import ActivityFeed from '@server/entity/ActivityFeed';
import UserFollow from '@server/entity/UserFollow';
import Comment from '@server/entity/Comment';
import User from '@server/entity/User';
import { MediaRequest } from '@server/entity/MediaRequest';
import logger from '@server/logger';

export class SocialEngine {
  /** Post an activity event. */
  async postActivity(userId: number, type: string, data: Record<string, unknown>, visibility = 'public') {
    const repo = getRepository(ActivityFeed);
    return repo.save(new ActivityFeed({ userId, type, data: JSON.stringify(data), visibility }));
  }

  /** Get activity feed for a user (their own + followed users). */
  async getFeed(userId: number, page = 1, pageSize = 20) {
    const followRepo = getRepository(UserFollow);
    const follows = await followRepo.find({ where: { followerId: userId } });
    const followingIds = [...follows.map(f => f.followingId), userId];

    const feedRepo = getRepository(ActivityFeed);
    return feedRepo.find({
      where: followingIds.map(id => ({ userId: id, visibility: 'public' })),
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  /** Get global activity (all public). */
  async getGlobalFeed(page = 1, pageSize = 20) {
    return getRepository(ActivityFeed).find({
      where: { visibility: 'public' },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  // --- Follows ---
  async followUser(followerId: number, followingId: number) {
    if (followerId === followingId) throw new Error('Cannot follow yourself');
    const repo = getRepository(UserFollow);
    const existing = await repo.findOne({ where: { followerId, followingId } });
    if (existing) return existing;
    return repo.save(new UserFollow({ followerId, followingId }));
  }

  async unfollowUser(followerId: number, followingId: number) {
    const repo = getRepository(UserFollow);
    const follow = await repo.findOne({ where: { followerId, followingId } });
    if (follow) await repo.remove(follow);
    return { unfollowed: true };
  }

  async getFollowers(userId: number) {
    const repo = getRepository(UserFollow);
    return repo.find({ where: { followingId: userId }, relations: ['follower'] });
  }

  async getFollowing(userId: number) {
    const repo = getRepository(UserFollow);
    return repo.find({ where: { followerId: userId }, relations: ['following'] });
  }

  // --- Comments ---
  async addComment(userId: number, sceneId: number, body: string, parentId?: number) {
    const repo = getRepository(Comment);
    return repo.save(new Comment({ userId, sceneId, body, parentId }));
  }

  async getSceneComments(sceneId: number, page = 1, pageSize = 20) {
    const repo = getRepository(Comment);
    return repo.find({
      where: { sceneId, parentId: null as any },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  async voteComment(commentId: number, direction: 'up' | 'down') {
    const repo = getRepository(Comment);
    const comment = await repo.findOne({ where: { id: commentId } });
    if (!comment) throw new Error('Comment not found');
    if (direction === 'up') comment.upvotes += 1;
    else comment.downvotes += 1;
    return repo.save(comment);
  }

  // --- Request Voting ---
  async voteRequest(requestId: number, userId: number) {
    const repo = getRepository(MediaRequest);
    const request = await repo.findOne({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    // Simple: increment a priority counter (could be a separate M2M)
    (request as any).votes = ((request as any).votes ?? 0) + 1;
    return repo.save(request);
  }

  // --- User Profiles ---
  async getUserProfile(userId: number) {
    const userRepo = getRepository(User);
    const followRepo = getRepository(UserFollow);
    const user = await userRepo.findOne({ where: { id: userId }, select: ['id', 'email', 'displayName', 'avatar', 'createdAt'] });
    if (!user) return null;
    const [followers, following] = await Promise.all([
      followRepo.count({ where: { followingId: userId } }),
      followRepo.count({ where: { followerId: userId } }),
    ]);
    return { ...user, followers, following };
  }

  /** Group Watch: create a session (lightweight coordination). */
  async createGroupWatch(hostUserId: number, sceneId: number, scheduledAt?: Date) {
    // Lightweight: store as activity with special type
    return this.postActivity(hostUserId, 'groupwatch', {
      sceneId,
      scheduledAt: scheduledAt?.toISOString(),
      participants: [hostUserId],
    }, 'public');
  }
}

export const socialEngine = new SocialEngine();
export default socialEngine;
