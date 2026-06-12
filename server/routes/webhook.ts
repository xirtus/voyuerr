import { getRepository } from '@server/datasource';
import WebhookSubscription, { WebhookEvent } from '@server/entity/WebhookSubscription';
import { isAuthenticated } from '@server/middleware/auth';
import { Router } from 'express';
import crypto from 'crypto';

const router = Router();
router.use(isAuthenticated());

router.get('/', async (req, res) => {
  const subs = await getRepository(WebhookSubscription).find({
    where: { userId: req.user!.id },
    order: { createdAt: 'DESC' },
  });
  res.json(subs.map(s => ({ ...s, secret: s.secret ? '••••' : undefined })));
});

router.post('/', async (req, res, next) => {
  try {
    const sub = getRepository(WebhookSubscription).create({
      userId: req.user!.id,
      name: req.body.name,
      url: req.body.url,
      events: (req.body.events as string[]).join(','),
      secret: req.body.secret || undefined,
    });
    await getRepository(WebhookSubscription).save(sub);
    res.status(201).json({ ...sub, secret: sub.secret ? '••••' : undefined });
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const repo = getRepository(WebhookSubscription);
    const sub = await repo.findOne({ where: { id: Number(req.params.id), userId: req.user!.id } });
    if (!sub) return next({ status: 404, message: 'Webhook not found' });
    if (req.body.name) sub.name = req.body.name;
    if (req.body.url) sub.url = req.body.url;
    if (req.body.events) sub.events = (req.body.events as string[]).join(',');
    if (req.body.secret) sub.secret = req.body.secret;
    if (req.body.enabled !== undefined) sub.enabled = req.body.enabled;
    await repo.save(sub);
    res.json({ ...sub, secret: sub.secret ? '••••' : undefined });
  } catch (e) { next({ status: 500, message: e.message }); }
});

router.delete('/:id', async (req, res, next) => {
  const result = await getRepository(WebhookSubscription).delete({
    id: Number(req.params.id), userId: req.user!.id,
  });
  if (!result.affected) return next({ status: 404, message: 'Webhook not found' });
  res.status(204).send();
});

router.post('/:id/test', async (req, res, next) => {
  try {
    const sub = await getRepository(WebhookSubscription).findOne({
      where: { id: Number(req.params.id), userId: req.user!.id },
    });
    if (!sub) return next({ status: 404, message: 'Webhook not found' });
    // Fire a test event
    const { webhookEngine } = await import('@server/lib/webhookEngine');
    await webhookEngine.fire(WebhookEvent.REQUEST_CREATED, { test: true, webhookId: sub.id });
    res.json({ sent: true });
  } catch (e) { next({ status: 500, message: e.message }); }
});

export default router;
