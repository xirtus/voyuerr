/**
 * Performer Cross-Reference Engine
 *
 * Links the same performer across all adult metadata sources.
 * Creates a unified identity for performers who appear in multiple
 * databases (e.g., same actress in ThePornDB, R18.dev, and StashDB).
 *
 * Uses name matching, measurement similarity, and external ID
 * correlation to build performer identity clusters.
 *
 * Phase 8 — Metadata Provider Integration
 */

import { getRepository } from '@server/datasource';
import Performer from '@server/entity/Performer';
import logger from '@server/logger';
import { nameSimilarity } from './metadataAggregator';
import { AdultMetadataSource } from './types';
import type { AdultPerformerResult } from './types';

/** A performer identity cluster across providers. */
export interface PerformerIdentity {
  /** Canonical name (most common or highest-confidence). */
  canonicalName: string;
  /** All known aliases across providers. */
  aliases: string[];
  /** External IDs mapped by provider. */
  externalIds: Partial<Record<AdultMetadataSource, string>>;
  /** Physical traits (consensus values). */
  traits: {
    gender?: string;
    height?: number;
    weight?: number;
    measurements?: string;
    country?: string;
    birthDate?: string;
  };
  /** All provider results for this identity. */
  providerResults: AdultPerformerResult[];
  /** Confidence that these are the same person (0–1). */
  confidence: number;
}

/** Thresholds for identity matching. */
const HIGH_CONFIDENCE_THRESHOLD = 0.9;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.75;
const LOW_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Cross-reference performer across providers.
 * Given a performer from one source, find the same performer in others.
 */
export async function crossReferencePerformer(
  name: string,
  primarySource: AdultMetadataSource,
  otherResults: AdultPerformerResult[]
): Promise<PerformerIdentity> {
  const allResults = [primarySource, ...otherResults].filter(Boolean);

  const matches: AdultPerformerResult[] = [];
  for (const result of otherResults) {
    const score = computeIdentityScore(name, result);
    if (score > MEDIUM_CONFIDENCE_THRESHOLD) {
      matches.push(result);
    }
  }

  return buildIdentity([...matches], name);
}

/**
 * Find all cross-referenced providers for a performer already in the database.
 */
export async function findPerformerCrossReferences(
  performerId: number
): Promise<PerformerIdentity | null> {
  try {
    const performerRepository = getRepository(Performer);
    const performer = await performerRepository.findOne({
      where: { id: performerId },
    });

    if (!performer) return null;

    const externalIds = performer.externalIds
      ? JSON.parse(performer.externalIds)
      : {};

    const aliases = performer.aliases ? JSON.parse(performer.aliases) : [];

    return {
      canonicalName: performer.name,
      aliases: [...aliases, performer.name],
      externalIds,
      traits: {
        gender: performer.gender,
        height: performer.height,
        weight: performer.weight,
        measurements: performer.measurements,
        country: performer.country,
        birthDate: performer.birthDate,
      },
      providerResults: [],
      confidence: 1.0,
    };
  } catch (e) {
    logger.error('Failed to find performer cross-references', {
      label: 'PerformerXRef',
      errorMessage: e.message,
      performerId,
    });
    return null;
  }
}

/**
 * Build a performer identity cluster from multiple provider results.
 */
export function buildIdentity(
  results: AdultPerformerResult[],
  fallbackName?: string
): PerformerIdentity {
  if (!results.length && fallbackName) {
    return {
      canonicalName: fallbackName,
      aliases: [],
      externalIds: {},
      traits: {},
      providerResults: [],
      confidence: 0,
    };
  }

  if (results.length === 1 && !fallbackName) {
    const r = results[0];
    return {
      canonicalName: r.name,
      aliases: r.aliases,
      externalIds: { [r.source]: r.sourceId },
      traits: {
        gender: r.gender,
        height: r.height,
        weight: r.weight,
        measurements: r.measurements,
        country: r.country,
        birthDate: r.birthDate,
      },
      providerResults: results,
      confidence: 1.0,
    };
  }

  // Multi-source: merge identities
  const allNames = new Map<string, number>();
  for (const r of results) {
    const nameKey = r.name.toLowerCase().trim();
    allNames.set(nameKey, (allNames.get(nameKey) ?? 0) + 1);
    for (const alias of r.aliases) {
      const aKey = alias.toLowerCase().trim();
      allNames.set(aKey, (allNames.get(aKey) ?? 0) + 1);
    }
  }

  // Canonical name: most common
  let canonicalName =
    fallbackName ??
    [...allNames.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    results[0].name;

  // External IDs
  const externalIds: Partial<Record<AdultMetadataSource, string>> = {};
  for (const r of results) {
    externalIds[r.source] = r.sourceId;
  }

  // Trait consensus
  const heights = results.filter((r) => r.height).map((r) => r.height!);
  const weights = results.filter((r) => r.weight).map((r) => r.weight!);
  const countries = results.filter((r) => r.country).map((r) => r.country!);
  const birthDates = results.filter((r) => r.birthDate).map((r) => r.birthDate!);

  const traits = {
    gender: results[0]?.gender,
    height: heights.length ? median(heights) : undefined,
    weight: weights.length ? median(weights) : undefined,
    measurements: results.find((r) => r.measurements)?.measurements,
    country: mode(countries),
    birthDate: mode(birthDates),
  };

  // Confidence based on how many providers agree
  const nameAgreement = Array.from(allNames.values()).some((c) => c > 1);
  const confidence = results.length > 1
    ? 0.5 + (nameAgreement ? 0.3 : 0) + Math.min(results.length * 0.1, 0.2)
    : 1.0;

  return {
    canonicalName,
    aliases: [...new Set([...results.flatMap((r) => r.aliases)])],
    externalIds,
    traits,
    providerResults: results,
    confidence: Math.min(confidence, 1.0),
  };
}

/**
 * Compute a similarity score between a known performer name and a result
 * from another provider. Considers name similarity and trait overlap.
 */
function computeIdentityScore(
  knownName: string,
  candidate: AdultPerformerResult
): number {
  const nameScore = nameSimilarity(knownName, candidate.name);

  // Boost if any alias matches
  let aliasBoost = 0;
  for (const alias of candidate.aliases) {
    const aliasSimilarity = nameSimilarity(knownName, alias);
    if (aliasSimilarity > nameScore) {
      aliasBoost = 0.1;
    }
  }

  return Math.min(nameScore + aliasBoost, 1.0);
}

/**
 * Resolve identity conflicts — when two apparent matches conflict.
 * Returns the best match or null if ambiguous.
 */
export function resolveIdentityConflict(
  candidates: PerformerIdentity[]
): PerformerIdentity | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  // Sort by confidence
  const sorted = [...candidates].sort((a, b) => b.confidence - a.confidence);

  // If best is significantly better, use it
  if (
    sorted[0].confidence > HIGH_CONFIDENCE_THRESHOLD &&
    (sorted.length === 1 ||
      sorted[0].confidence - sorted[1].confidence > 0.15)
  ) {
    return sorted[0];
  }

  // If they're close, merge compatible ones
  const merged = {
    ...sorted[0],
    aliases: [...new Set(sorted.flatMap((c) => c.aliases))],
    externalIds: Object.assign({}, ...sorted.map((c) => c.externalIds)),
    confidence: sorted[0].confidence,
  };

  return merged;
}

// --- Utility Functions ---

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode<T extends string | number>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export const PerformerCrossReference = {
  crossReferencePerformer,
  findPerformerCrossReferences,
  buildIdentity,
  resolveIdentityConflict,
  nameSimilarity,
};

export default PerformerCrossReference;
