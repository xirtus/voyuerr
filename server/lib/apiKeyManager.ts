import { getRepository } from '@server/datasource';
import ApiKey, { ApiKeyScope } from '@server/entity/ApiKey';
import { User } from '@server/entity/User';
import logger from '@server/logger';
import crypto from 'crypto';

export interface CreateApiKeyOptions {
  userId: number;
  name: string;
  scope?: ApiKeyScope;
  rateLimitRpm?: number;
  rateLimitBurst?: number;
  expiresAt?: Date;
}

export interface ApiKeyWithPlaintext {
  apiKey: ApiKey;
  plaintext: string;
}

class ApiKeyManager {
  /**
   * Generate a new API key. Returns the entity + plaintext key.
   * The plaintext is only shown once — we store only the SHA-256 hash.
   */
  async createKey(opts: CreateApiKeyOptions): Promise<ApiKeyWithPlaintext> {
    const repo = getRepository(ApiKey);
    const prefix = 'vk_';
    const randomBytes = crypto.randomBytes(32);
    const plaintext = prefix + randomBytes.toString('base64url');
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
    const keyPrefix = plaintext.slice(-8);

    const key = repo.create({
      userId: opts.userId,
      name: opts.name,
      keyHash,
      keyPrefix,
      scope: opts.scope ?? ApiKeyScope.READ_ONLY,
      rateLimitRpm: opts.rateLimitRpm,
      rateLimitBurst: opts.rateLimitBurst,
      expiresAt: opts.expiresAt,
    });
    await repo.save(key);
    logger.info('API key created', { label: 'ApiKey', userId: opts.userId, keyId: key.id });
    return { apiKey: key, plaintext };
  }

  /** Validate an API key and return the associated user. */
  async validateKey(plaintext: string): Promise<{ user: User; apiKey: ApiKey } | null> {
    const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
    const repo = getRepository(ApiKey);
    const key = await repo.findOne({ where: { keyHash, enabled: true }, relations: ['user'] });
    if (!key) return null;
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) return null;

    // Update usage stats
    key.lastUsedAt = new Date();
    key.requestCount++;
    await repo.save(key);

    return { user: key.user, apiKey: key };
  }

  /** List keys for a user (never returns hashes). */
  async listKeys(userId: number) {
    return getRepository(ApiKey).find({
      where: { userId },
      select: ['id', 'name', 'keyPrefix', 'scope', 'rateLimitRpm', 'rateLimitBurst', 'expiresAt', 'lastUsedAt', 'requestCount', 'enabled', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Revoke a key. */
  async revokeKey(keyId: number, userId: number): Promise<boolean> {
    const repo = getRepository(ApiKey);
    const key = await repo.findOne({ where: { id: keyId, userId } });
    if (!key) return false;
    key.enabled = false;
    await repo.save(key);
    return true;
  }

  /** Delete a key entirely. */
  async deleteKey(keyId: number, userId: number): Promise<boolean> {
    const result = await getRepository(ApiKey).delete({ id: keyId, userId });
    return (result.affected ?? 0) > 0;
  }
}

export const apiKeyManager = new ApiKeyManager();
export default apiKeyManager;
