/**
 * Voyeurr Load Testing Script
 *
 * Simulates 100+ concurrent users browsing scenes, performers, studios,
 * and submitting requests. Uses autocannon for HTTP load generation.
 *
 * Phase 7 — Documentation, Testing & Deployment
 *
 * Usage: npx ts-node bin/load-test.ts http://localhost:5055
 */

import autocannon from 'autocannon';
import { randomInt } from 'crypto';

const TARGET = process.argv[2] || 'http://localhost:5055';
const CONCURRENT_USERS = 100;
const DURATION_SECONDS = 60;

const adultScenarios = [
  // Discover page (most common)
  { path: '/api/v1/discover/adult/trending', weight: 30 },
  { path: '/api/v1/discover/adult/new', weight: 20 },
  { path: '/api/v1/discover/adult/performers', weight: 15 },
  { path: '/api/v1/discover/adult/studios', weight: 10 },

  // Scene details
  { path: '/api/v1/scene/1', weight: 10 },
  { path: '/api/v1/scene/2', weight: 5 },

  // Performer profiles
  { path: '/api/v1/performer/1', weight: 5 },
  { path: '/api/v1/performer/1/scenes', weight: 3 },

  // Studio pages
  { path: '/api/v1/studio/1', weight: 1 },
  { path: '/api/v1/studio/1/scenes', weight: 1 },
];

// Weighted random selection
function pickScenario() {
  const total = adultScenarios.reduce((sum, s) => sum + s.weight, 0);
  let rand = randomInt(0, total);
  for (const scenario of adultScenarios) {
    rand -= scenario.weight;
    if (rand <= 0) return scenario.path;
  }
  return adultScenarios[0].path;
}

console.log(`🔞 Voyeurr Load Test`);
console.log(`   Target:     ${TARGET}`);
console.log(`   Users:      ${CONCURRENT_USERS} concurrent`);
console.log(`   Duration:   ${DURATION_SECONDS}s`);
console.log(`   Scenarios:  ${adultScenarios.length}`);
console.log('');

const instance = autocannon({
  url: TARGET,
  connections: CONCURRENT_USERS,
  duration: DURATION_SECONDS,
  timeout: 30,
  requests: adultScenarios.map((s) => ({
    path: s.path,
    method: 'GET',
    headers: {
      'X-API-Key': process.env.VOYEURR_API_KEY || 'test-api-key',
      'Accept': 'application/json',
    },
  })),
});

autocannon.track(instance, {
  renderProgressBar: true,
  renderResultsTable: true,
});

instance.on('done', (result) => {
  console.log('\n📊 Results:');
  console.log(`   Requests:    ${result.requests.total}`);
  console.log(`   2xx:         ${result['2xx']}`);
  console.log(`   Errors:      ${result.errors}`);
  console.log(`   Latency avg: ${result.latency.average}ms`);
  console.log(`   Latency p99: ${result.latency.p99}ms`);
  console.log(`   Req/sec:     ${result.requests.average}`);

  // Pass/fail criteria
  const errorRate = result.errors / (result.requests.total || 1);
  if (errorRate > 0.05) {
    console.error('❌ FAIL: Error rate exceeds 5%');
    process.exit(1);
  }
  if (result.latency.p99 > 2000) {
    console.error('❌ FAIL: p99 latency exceeds 2000ms');
    process.exit(1);
  }
  console.log('✅ PASS: Load test passed');
});
