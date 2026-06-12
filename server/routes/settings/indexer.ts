import JackettAPI from '@server/api/indexers/jackett';
import ProwlarrAPI from '@server/api/indexers/prowlarr';
import type { IndexerSettings } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';

const indexerRoutes = Router();

indexerRoutes.get('/', (_req, res) => {
  const settings = getSettings();
  res.status(200).json(settings.indexer);
});

indexerRoutes.post('/', async (req, res) => {
  const settings = getSettings();

  const newIndexer = req.body as IndexerSettings;
  const lastItem = settings.indexer[settings.indexer.length - 1];
  newIndexer.id = lastItem ? lastItem.id + 1 : 0;

  settings.indexer = [...settings.indexer, newIndexer];
  await settings.save();

  return res.status(201).json(newIndexer);
});

indexerRoutes.post('/test', async (req, res, next) => {
  const { type, hostname, port, apiKey, useSsl, baseUrl } = req.body;

  try {
    const baseUrlStr = baseUrl ? (baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`) : '';
    const protocol = useSsl ? 'https' : 'http';
    const url = `${protocol}://${hostname}:${port}${baseUrlStr}`;

    let version: string;
    let indexers: { id: string; name: string; configured: boolean }[] = [];

    if (type === 'jackett') {
      const jackett = new JackettAPI({ url, apiKey });
      const result = await jackett.testConnection();
      version = result.version;

      const idxResponse = await jackett.getIndexers();
      indexers = idxResponse.indexers.map((i) => ({
        id: i.id,
        name: i.name,
        configured: i.configured,
      }));
    } else {
      const prowlarr = new ProwlarrAPI({ url, apiKey });
      const result = await prowlarr.testConnection();
      version = result.version;

      const idxResponse = await prowlarr.getIndexers();
      indexers = idxResponse.map((i) => ({
        id: String(i.id),
        name: i.name,
        configured: i.enable,
      }));
    }

    return res.status(200).json({ version, indexers });
  } catch (e) {
    logger.error('Failed to test indexer connection', {
      label: 'Indexer',
      message: e.message,
    });
    next({ status: 500, message: `Failed to connect: ${e.message}` });
  }
});

indexerRoutes.put<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();

  const index = settings.indexer.findIndex(
    (r) => r.id === Number(req.params.id)
  );

  if (index === -1) {
    return next({ status: 404, message: 'Settings instance not found' });
  }

  settings.indexer[index] = {
    ...req.body,
    id: Number(req.params.id),
  } as IndexerSettings;
  await settings.save();

  return res.status(200).json(settings.indexer[index]);
});

indexerRoutes.get<{ id: string }>('/:id/health', async (req, res, next) => {
  const settings = getSettings();

  const idx = settings.indexer.find(
    (r) => r.id === Number(req.params.id)
  );

  if (!idx) {
    return next({ status: 404, message: 'Indexer not found' });
  }

  try {
    const baseUrlStr = idx.baseUrl
      ? idx.baseUrl.startsWith('/')
        ? idx.baseUrl
        : `/${idx.baseUrl}`
      : '';
    const protocol = idx.useSsl ? 'https' : 'http';
    const url = `${protocol}://${idx.hostname}:${idx.port}${baseUrlStr}`;

    let health;
    if (idx.type === 'jackett') {
      const jackett = new JackettAPI({ url, apiKey: idx.apiKey });
      health = await jackett.checkHealth();
    } else {
      const prowlarr = new ProwlarrAPI({ url, apiKey: idx.apiKey });
      health = await prowlarr.checkHealth();
    }

    return res.status(200).json(health);
  } catch (e) {
    logger.error('Indexer health check failed', {
      label: 'Indexer',
      error: e.message,
    });
    next({ status: 500, message: 'Health check failed' });
  }
});

indexerRoutes.delete<{ id: string }>('/:id', async (req, res, next) => {
  const settings = getSettings();

  const index = settings.indexer.findIndex(
    (r) => r.id === Number(req.params.id)
  );

  if (index === -1) {
    return next({ status: 404, message: 'Settings instance not found' });
  }

  const removed = settings.indexer.splice(index, 1);
  await settings.save();

  return res.status(200).json(removed[0]);
});

export default indexerRoutes;
