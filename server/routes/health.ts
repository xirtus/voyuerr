/**
 * Health check & readiness probes — Phase 14
 * Kubernetes-compatible liveness/readiness endpoints, Prometheus metrics,
 * graceful shutdown handling.
 */
import dataSource from '@server/datasource';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';

const router = Router();
let isShuttingDown = false;

/** Track metrics in memory (lightweight, no external dep). */
const metrics = {
  requests: 0,
  errors: 0,
  responseTimeTotal: 0,
  activeConnections: 0,
};

// Track all request metrics
export function trackRequest(durationMs: number, isError = false) {
  metrics.requests++;
  metrics.responseTimeTotal += durationMs;
  if (isError) metrics.errors++;
}

export function trackConnection(delta: number) {
  metrics.activeConnections = Math.max(0, metrics.activeConnections + delta);
}

/** Liveness probe — is the process alive? */
router.get('/live', (_req, res) => {
  if (isShuttingDown) return res.status(503).json({ status: 'shutting_down' });
  res.json({ status: 'alive', uptime: process.uptime() });
});

/** Readiness probe — can the app serve traffic? */
router.get('/ready', async (_req, res) => {
  if (isShuttingDown) return res.status(503).json({ status: 'not_ready', reason: 'shutting_down' });

  try {
    // Check DB connection
    if (!dataSource.isInitialized) {
      return res.status(503).json({ status: 'not_ready', reason: 'database_not_initialized' });
    }
    await dataSource.query('SELECT 1');

    res.json({ status: 'ready', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'not_ready', reason: 'database_unreachable' });
  }
});

/** Prometheus-compatible metrics endpoint. */
router.get('/metrics', (_req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = os.loadavg();

  const promMetrics = [
    '# HELP voyeurr_uptime_seconds Server uptime in seconds',
    '# TYPE voyeurr_uptime_seconds gauge',
    `voyeurr_uptime_seconds ${process.uptime()}`,
    '',
    '# HELP voyeurr_requests_total Total HTTP requests served',
    '# TYPE voyeurr_requests_total counter',
    `voyeurr_requests_total ${metrics.requests}`,
    '',
    '# HELP voyeurr_errors_total Total HTTP errors',
    '# TYPE voyeurr_errors_total counter',
    `voyeurr_errors_total ${metrics.errors}`,
    '',
    '# HELP voyeurr_response_time_avg_ms Average response time in ms',
    '# TYPE voyeurr_response_time_avg_ms gauge',
    `voyeurr_response_time_avg_ms ${metrics.requests > 0 ? Math.round(metrics.responseTimeTotal / metrics.requests) : 0}`,
    '',
    '# HELP voyeurr_active_connections Current active connections',
    '# TYPE voyeurr_active_connections gauge',
    `voyeurr_active_connections ${metrics.activeConnections}`,
    '',
    '# HELP voyeurr_memory_bytes Node.js memory usage',
    '# TYPE voyeurr_memory_bytes gauge',
    `voyeurr_memory_bytes{rss="${memUsage.rss}",heap_total="${memUsage.heapTotal}",heap_used="${memUsage.heapUsed}",external="${memUsage.external}"} 1`,
    '',
    '# HELP voyeurr_cpu_load System CPU load average',
    '# TYPE voyeurr_cpu_load gauge',
    `voyeurr_cpu_load{interval="1m"} ${cpuUsage[0]}`,
    `voyeurr_cpu_load{interval="5m"} ${cpuUsage[1]}`,
    `voyeurr_cpu_load{interval="15m"} ${cpuUsage[2]}`,
    '',
  ].join('\n');

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(promMetrics);
});

/** Shutdown gracefully. */
export async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown...`, { label: 'Server' });
  isShuttingDown = true;

  // Stop accepting new connections (handled by server.close in index.ts)
  // Wait for existing requests to complete (max 30s)
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Close DB
  try {
    if (dataSource.isInitialized) await dataSource.destroy();
  } catch (e) {
    logger.error('Error closing DB connection', { label: 'Server', errorMessage: e.message });
  }

  logger.info('Graceful shutdown complete', { label: 'Server' });
  process.exit(0);
}

export function isServerShuttingDown() { return isShuttingDown; }

/** Startup readiness check — wait for DB before accepting traffic. */
export async function waitForReady(timeoutMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (dataSource.isInitialized) {
        await dataSource.query('SELECT 1');
        logger.info('Server is ready to accept traffic', { label: 'Server' });
        return true;
      }
    } catch { /* still initializing */ }
    await new Promise(r => setTimeout(r, 500));
  }
  logger.error('Server failed to become ready within timeout', { label: 'Server' });
  return false;
}

export default router;
