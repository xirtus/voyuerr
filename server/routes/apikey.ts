import { getRepository } from '@server/datasource';
import ApiKey, { ApiKeyScope } from '@server/entity/ApiKey';
import apiKeyManager from '@server/lib/apiKeyManager';
import { Permission } from '@server/lib/permissions';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';

const router = Router();
router.use(isAuthenticated());

router.get('/', async (req, res) => {
  res.json(await apiKeyManager.listKeys(req.user!.id));
});

router.post('/', async (req, res, next) => {
  try {
    const result = await apiKeyManager.createKey({
      userId: req.user!.id,
      name: req.body.name,
      scope: req.body.scope as ApiKeyScope,
      rateLimitRpm: req.body.rateLimitRpm,
      rateLimitBurst: req.body.rateLimitBurst,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    });
    res.status(201).json({
      id: result.apiKey.id,
      name: result.apiKey.name,
      keyPrefix: result.apiKey.keyPrefix,
      scope: result.apiKey.scope,
      expiresAt: result.apiKey.expiresAt,
      apiKey: result.plaintext,
    });
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const repo = getRepository(ApiKey);
    const key = await repo.findOne({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!key) return next({ status: 404, message: 'API key not found' });
    if (req.body.name) key.name = req.body.name;
    if (req.body.scope) key.scope = req.body.scope;
    if (req.body.enabled !== undefined) key.enabled = req.body.enabled;
    if (req.body.rateLimitRpm !== undefined) key.rateLimitRpm = req.body.rateLimitRpm;
    await repo.save(key);
    res.json(key);
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.delete('/:id', async (req, res, next) => {
  const ok = await apiKeyManager.deleteKey(Number(req.params.id), req.user!.id);
  if (!ok) return next({ status: 404, message: 'API key not found' });
  res.status(204).send();
});

export default router;
