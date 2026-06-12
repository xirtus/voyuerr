/**
 * Multi-Source Metadata Aggregator
 *
 * Fuses metadata from multiple adult content providers into unified,
 * high-confidence results. Handles merge conflict resolution, confidence
 * scoring, and source attribution.
 *
 * Providers:
 *   - ThePornDB (tpdb) — universal adult metadata
 *   - R18.dev (r18) — JAV-specific
 *   - AdultDVDEmpire (ade) — Western DVD/VOD
 *   - nHentai (nhentai) — Hentai manga
 *   - Hanime (hanime) — Hentai anime
 *   - Fakku (fakku) — Licensed hentai manga
 *
 * Phase 8 — Metadata Provider Integration
 */

import { PerformerGender } from '@server/constants/content';
import logger from '@server/logger';
import AdultDVDEmpireAPI from './adultdvdempire';
import FakkuAPI from './fakku';
import HanimeAPI from './hanime';
import NHentai from './nhentai';
import R18API from './r18';
import ThePornDB from './tpdb';
import { AdultMetadataSource } from './types';
import type {
  AdultPerformerInfo,
  AdultPerformerResult,
  AdultSceneResult,
  AdultSearchQuery,
  AdultSearchResponse,
  AdultStudioInfo,
  AggregatedPerformerMetadata,
  AggregatedSceneMetadata,
  ConfidenceScore,
  MetadataSource,
} from './types';

/** Circuit breaker state for a single provider. */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  cooldownUntil: number;
  isOpen: boolean;
}

/** Provider configuration. */
interface ProviderConfig {
  source: AdultMetadataSource;
  enabled: boolean;
  apiKey?: string;
  /** Priority weight for conflict resolution (higher = more trusted). */
  priority: number;
  /** Per-provider request timeout in milliseconds. */
  timeoutMs: number;
}

/** Circuit breaker thresholds. */
const CIRCUIT_BREAKER_MAX_FAILURES = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000; // 1 minute
const CIRCUIT_BREAKER_HALF_OPEN_AFTER = 30_000; // 30 seconds before trial reset

/** Default per-provider timeouts (milliseconds). */
const PROVIDER_TIMEOUTS: Record<AdultMetadataSource, number> = {
  [AdultMetadataSource.TPDB]: 10_000,
  [AdultMetadataSource.R18]: 15_000,
  [AdultMetadataSource.ADULT_DVD_EMPIRE]: 12_000,
  [AdultMetadataSource.NHENTAI]: 10_000,
  [AdultMetadataSource.FAKKU]: 10_000,
  [AdultMetadataSource.HANIME]: 12_000,
  [AdultMetadataSource.STASH]: 8_000,
};

/** Default provider trust priorities. */
const DEFAULT_PRIORITIES: Record<AdultMetadataSource, number> = {
  [AdultMetadataSource.TPDB]: 90,
  [AdultMetadataSource.R18]: 85,
  [AdultMetadataSource.ADULT_DVD_EMPIRE]: 75,
  [AdultMetadataSource.NHENTAI]: 70,
  [AdultMetadataSource.FAKKU]: 65,
  [AdultMetadataSource.HANIME]: 60,
  [AdultMetadataSource.STASH]: 95,
};

/** String similarity threshold for fuzzy matching (0–1). */
const SIMILARITY_THRESHOLD = 0.85;

/**
 * Simple Jaro-Winkler-like name similarity for matching
 * performers across different providers.
 */
function nameSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim().replace(/\s+/g, ' ');
  const bNorm = b.toLowerCase().trim().replace(/\s+/g, ' ');

  if (aNorm === bNorm) return 1.0;

  // Exact match after handling common variations
  const aParts = aNorm.split(' ');
  const bParts = bNorm.split(' ');

  // First name / Last name swap (Japanese vs Western ordering)
  if (aParts.length >= 2 && bParts.length >= 2) {
    // Check reversed name order (e.g., "Yua Mikami" vs "Mikami Yua")
    const aReversed = [...aParts].reverse().join(' ');
    const bReversed = [...bParts].reverse().join(' ');
    if (aReversed === bNorm || bReversed === aNorm) return 0.98;
  }

  // Check if one is a substring of the other
  if (aNorm.includes(bNorm) || bNorm.includes(aNorm)) return 0.95;

  // Jaro-Winkler-like approximation
  const maxLen = Math.max(aNorm.length, bNorm.length);
  if (maxLen === 0) return 1.0;

  let matches = 0;
  const matchDistance = Math.floor(maxLen / 2) - 1;
  const aMatched = new Array(aNorm.length).fill(false);
  const bMatched = new Array(bNorm.length).fill(false);

  for (let i = 0; i < aNorm.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, bNorm.length);
    for (let j = start; j < end; j++) {
      if (!bMatched[j] && aNorm[i] === bNorm[j]) {
        aMatched[i] = true;
        bMatched[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < aNorm.length; i++) {
    if (aMatched[i]) {
      while (!bMatched[k]) k++;
      if (aNorm[i] !== bNorm[k]) transpositions++;
      k++;
    }
  }

  const jaro =
    (matches / aNorm.length +
      matches / bNorm.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler boost for common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, aNorm.length, bNorm.length); i++) {
    if (aNorm[i] === bNorm[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

class MetadataAggregator {
  private providers: Partial<Record<AdultMetadataSource, ProviderConfig>> = {};
  private circuits: Partial<Record<AdultMetadataSource, CircuitBreakerState>> = {};

  /** Initialize circuit breaker state for a provider. */
  private initCircuit(source: AdultMetadataSource): CircuitBreakerState {
    if (!this.circuits[source]) {
      this.circuits[source] = {
        failures: 0,
        lastFailure: 0,
        cooldownUntil: 0,
        isOpen: false,
      };
    }
    return this.circuits[source]!;
  }

  /** Check if circuit is tripped (open) for a provider. */
  private isCircuitOpen(source: AdultMetadataSource): boolean {
    const cb = this.circuits[source];
    if (!cb) return false;
    if (!cb.isOpen) return false;

    const now = Date.now();
    // After cooldown, try half-open (allow one request through)
    if (now > cb.cooldownUntil) {
      cb.isOpen = false;
      cb.failures = Math.floor(cb.failures / 2); // Reduce but don't reset fully
      logger.info(`Circuit half-open for ${source}`, { label: 'MetadataAggregator' });
      return false;
    }
    return true;
  }

  /** Record a successful provider call. */
  private recordSuccess(source: AdultMetadataSource): void {
    const cb = this.circuits[source];
    if (!cb) return;
    cb.failures = Math.max(0, cb.failures - 1);
    cb.isOpen = false;
    cb.cooldownUntil = 0;
  }

  /** Record a failed provider call and trip circuit if threshold exceeded. */
  private recordFailure(source: AdultMetadataSource): void {
    const cb = this.initCircuit(source);
    cb.failures++;
    cb.lastFailure = Date.now();

    if (cb.failures >= CIRCUIT_BREAKER_MAX_FAILURES) {
      cb.isOpen = true;
      cb.cooldownUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      logger.warn(`Circuit breaker OPEN for ${source} after ${cb.failures} failures`, {
        label: 'MetadataAggregator',
        cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
      });
    }
  }

  /**
   * Execute a provider call with timeout and circuit breaker protection.
   * Returns null if the call fails, times out, or the circuit is open.
   */
  private async withProtection<T>(
    source: AdultMetadataSource,
    fn: () => Promise<T>
  ): Promise<T | null> {
    if (this.isCircuitOpen(source)) {
      logger.debug(`Skipping ${source} — circuit breaker open`, { label: 'MetadataAggregator' });
      return null;
    }

    const timeoutMs = this.providers[source]?.timeoutMs ?? PROVIDER_TIMEOUTS[source] ?? 10_000;

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);
      this.recordSuccess(source);
      return result;
    } catch (e) {
      this.recordFailure(source);
      logger.warn(`Provider ${source} call failed`, {
        label: 'MetadataAggregator',
        errorMessage: e instanceof Error ? e.message : String(e),
        circuitState: this.circuits[source]?.isOpen ? 'open' : 'closed',
      });
      return null;
    }
  }

  /** Register a metadata provider. */
  registerProvider(source: AdultMetadataSource, config: Partial<ProviderConfig> = {}): void {
    this.providers[source] = {
      source,
      enabled: config.enabled ?? true,
      apiKey: config.apiKey,
      priority: config.priority ?? DEFAULT_PRIORITIES[source] ?? 50,
      timeoutMs: config.timeoutMs ?? PROVIDER_TIMEOUTS[source] ?? 10_000,
    };
    this.initCircuit(source);
    logger.info(`Registered adult metadata provider: ${source}`, {
      label: 'AdultMetadata',
    });
  }

  /** Remove a provider. */
  unregisterProvider(source: AdultMetadataSource): void {
    delete this.providers[source];
  }

  /** Get list of enabled providers. */
  getEnabledProviders(): AdultMetadataSource[] {
    return Object.values(this.providers)
      .filter((p) => p.enabled)
      .map((p) => p.source);
  }

  /** Check if a specific provider is enabled. */
  isProviderEnabled(source: AdultMetadataSource): boolean {
    return this.providers[source]?.enabled ?? false;
  }

  /**
   * Search across all enabled providers and aggregate results.
   * Returns deduplicated, merged scene results.
   */
  async searchScenes(query: AdultSearchQuery): Promise<AdultSearchResponse<AggregatedSceneMetadata>> {
    const enabledProviders = query.providers?.filter((p) => this.isProviderEnabled(p))
      ?? this.getEnabledProviders();

    if (!enabledProviders.length) {
      return { results: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 25, providers: [] };
    }

    const allResults: AdultSceneResult[] = [];
    const errors: string[] = [];

    // Query each provider in parallel with circuit breaker + timeout protection
    const providerPromises = enabledProviders.map(async (source) => {
      const result = await this.withProtection(source, () =>
        this.queryProvider(source, query.query, query)
      );
      if (result === null) {
        errors.push(`${source}: circuit open, timeout, or error`);
        return [];
      }
      return result;
    });

    const resultsArrays = await Promise.all(providerPromises);
    for (const arr of resultsArrays) allResults.push(...arr);

    // Deduplicate and merge
    const merged = this.deduplicateAndMerge(allResults);

    // Paginate
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    const paginated = merged.slice(start, start + pageSize);

    return {
      results: paginated,
      total: merged.length,
      page,
      pageSize,
      providers: enabledProviders,
    };
  }

  /**
   * Get aggregated scene metadata from all providers by searching for
   * a specific scene ID across multiple providers.
   */
  async getAggregatedScene(
    sourceId: string,
    primarySource: AdultMetadataSource,
    crossCheck = true
  ): Promise<AggregatedSceneMetadata | null> {
    try {
      const primary = await this.getSceneFromProvider(primarySource, sourceId);
      if (!primary) return null;

      if (!crossCheck) return this.buildAggregatedScene([primary]);

      // Try to find the same scene in other providers by title
      const otherSources = this.getEnabledProviders().filter((s) => s !== primarySource);
      const otherResults: AdultSceneResult[] = [];

      for (const source of otherSources.slice(0, 3)) {
        // Limit cross-checking to 3 providers for performance
        const results = await this.withProtection(source, () =>
          this.queryProvider(source, primary.title, {
            query: primary.title,
            pageSize: 3,
          })
        );
        if (results) {
          // Find best match by title similarity
          const bestMatch = results.find(
            (r) => nameSimilarity(r.title, primary.title) > SIMILARITY_THRESHOLD
          );
          if (bestMatch) otherResults.push(bestMatch);
        }
      }

      return this.buildAggregatedScene([primary, ...otherResults]);
    } catch (e) {
      logger.error('Failed to get aggregated scene', {
        label: 'MetadataAggregator',
        errorMessage: e.message,
        sourceId,
        source: primarySource,
      });
      return null;
    }
  }

  /**
   * Get aggregated performer metadata from multiple sources.
   */
  async getAggregatedPerformer(
    name: string,
    primarySource?: AdultMetadataSource
  ): Promise<AggregatedPerformerMetadata | null> {
    const providers = primarySource
      ? [primarySource]
      : this.getEnabledProviders();

    const performerResults: AdultPerformerResult[] = [];

    for (const source of providers) {
      const results = await this.withProtection(source, () =>
        this.searchPerformerInProvider(source, name)
      );
      if (results && results.length > 0) {
        // Get full details for best match
        const bestMatch = results[0];
        if (primarySource) {
          performerResults.push(bestMatch);
          break;
        }
        performerResults.push(bestMatch);
      }
    }

    if (!performerResults.length) return null;

    return this.buildAggregatedPerformer(performerResults);
  }

  // --- Private Methods ---

  /** Query a single provider. */
  private async queryProvider(
    source: AdultMetadataSource,
    query: string,
    options?: Partial<AdultSearchQuery>
  ): Promise<AdultSceneResult[]> {
    switch (source) {
      case AdultMetadataSource.TPDB: {
        const api = new ThePornDB(this.providers[source]?.apiKey);
        const response = await api.searchScenes(query, {
          page: options?.page,
          pageSize: options?.pageSize,
          performers: options?.performerName,
          studio: options?.studioName,
        });
        return response.data.map((s) => api.mapScene(s));
      }
      case AdultMetadataSource.R18: {
        const api = new R18API(this.providers[source]?.apiKey);
        const response = await api.searchScenes(query, {
          page: options?.page,
          pageSize: options?.pageSize,
          actress: options?.performerName,
          studio: options?.studioName,
        });
        return response.scenes;
      }
      case AdultMetadataSource.ADULT_DVD_EMPIRE: {
        const api = new AdultDVDEmpireAPI(this.providers[source]?.apiKey);
        const response = await api.searchScenes(query, {
          page: options?.page,
          pageSize: options?.pageSize,
          performer: options?.performerName,
          studio: options?.studioName,
        });
        return response.scenes;
      }
      case AdultMetadataSource.NHENTAI: {
        const api = new NHentai();
        const response = await api.searchGalleries(query, {
          page: options?.page,
        });
        return response.galleries;
      }
      case AdultMetadataSource.HANIME: {
        const api = new HanimeAPI();
        const response = await api.searchVideos(query, {
          page: options?.page ? options.page - 1 : 0,
          brand: options?.studioName,
        });
        return response.videos;
      }
      case AdultMetadataSource.FAKKU: {
        const api = new FakkuAPI();
        const response = await api.searchManga(query, {
          page: options?.page,
          pageSize: options?.pageSize,
          artists: options?.performerName ? [options.performerName] : undefined,
        });
        return response.manga;
      }
      default:
        return [];
    }
  }

  /** Get a single scene from a specific provider. */
  private async getSceneFromProvider(
    source: AdultMetadataSource,
    id: string
  ): Promise<AdultSceneResult | null> {
    try {
      switch (source) {
        case AdultMetadataSource.TPDB:
          return await new ThePornDB(this.providers[source]?.apiKey).getScene(id);
        case AdultMetadataSource.R18:
          return await new R18API(this.providers[source]?.apiKey).getScene(id);
        case AdultMetadataSource.ADULT_DVD_EMPIRE:
          return await new AdultDVDEmpireAPI(this.providers[source]?.apiKey).getScene(id);
        case AdultMetadataSource.NHENTAI:
          return await new NHentai().getGallery(id);
        case AdultMetadataSource.HANIME:
          return await new HanimeAPI().getVideo(Number(id));
        case AdultMetadataSource.FAKKU:
          return await new FakkuAPI().getBook(id);
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /** Search for a performer in a specific provider. */
  private async searchPerformerInProvider(
    source: AdultMetadataSource,
    name: string
  ): Promise<AdultPerformerResult[]> {
    switch (source) {
      case AdultMetadataSource.TPDB: {
        const api = new ThePornDB(this.providers[source]?.apiKey);
        const result = await api.searchPerformers(name);
        return result.performers;
      }
      case AdultMetadataSource.R18: {
        const api = new R18API(this.providers[source]?.apiKey);
        const result = await api.searchActresses(name);
        return result.actresses;
      }
      case AdultMetadataSource.ADULT_DVD_EMPIRE:
        return []; // ADE performer search returns different format
      default:
        return [];
    }
  }

  /**
   * Deduplicate scene results and merge metadata from multiple sources.
   */
  private deduplicateAndMerge(results: AdultSceneResult[]): AggregatedSceneMetadata[] {
    // Group by normalized title (approximate)
    const groups: Map<string, AdultSceneResult[]> = new Map();

    for (const result of results) {
      const normTitle = result.title.toLowerCase().trim();
      let found = false;

      for (const [key, group] of groups) {
        if (nameSimilarity(normTitle, key) > SIMILARITY_THRESHOLD) {
          group.push(result);
          found = true;
          break;
        }
      }

      if (!found) {
        groups.set(normTitle, [result]);
      }
    }

    // Merge each group into an aggregated result
    return Array.from(groups.values()).map((group) =>
      this.buildAggregatedScene(group)
    );
  }

  /**
   * Build an aggregated scene from multiple source results.
   * Resolves conflicts using priority and field-level voting.
   */
  private buildAggregatedScene(sources: AdultSceneResult[]): AggregatedSceneMetadata {
    if (sources.length === 1) {
      const s = sources[0];
      return {
        title: s.title,
        originalTitle: s.originalTitle,
        releaseDate: s.releaseDate,
        runtime: s.runtime,
        description: s.description,
        categories: s.categories,
        tags: this.uniqueStrings(sources.flatMap((r) => r.tags)),
        posterUrl: s.posterUrl,
        backdropUrl: s.backdropUrl,
        trailerUrl: s.trailerUrl,
        studio: s.studio,
        performers: this.mergePerformers(sources),
        sources: {
          title: this.sourceAttribution(s.source, s.sourceId, s.title),
          description: s.description
            ? this.sourceAttribution(s.source, s.sourceId, s.description)
            : undefined,
          releaseDate: s.releaseDate
            ? this.sourceAttribution(s.source, s.sourceId, s.releaseDate)
            : undefined,
          runtime: s.runtime
            ? this.sourceAttribution(s.source, s.sourceId, String(s.runtime))
            : undefined,
          studio: s.studio
            ? this.sourceAttribution(s.source, s.sourceId, s.studio.name)
            : undefined,
          poster: s.posterUrl
            ? this.sourceAttribution(s.source, s.sourceId, s.posterUrl)
            : undefined,
          backdrop: s.backdropUrl
            ? this.sourceAttribution(s.source, s.sourceId, s.backdropUrl)
            : undefined,
          trailer: s.trailerUrl
            ? this.sourceAttribution(s.source, s.sourceId, s.trailerUrl)
            : undefined,
        },
        confidence: this.calculateConfidence(sources),
      };
    }

    // Multi-source: resolve conflicts
    const sortedSources = [...sources].sort(
      (a, b) =>
        (this.providers[b.source]?.priority ?? 50) -
        (this.providers[a.source]?.priority ?? 50)
    );

    const best = sortedSources[0];

    // Title: vote from all sources
    const titleVotes = this.fieldVote(
      sortedSources.map((s) => ({
        value: s.title,
        source: s.source,
        sourceId: s.sourceId,
        confidence: this.providers[s.source]?.priority ?? 50,
      }))
    );

    // Description: longest non-empty (usually most informative)
    const bestDesc = sortedSources
      .filter((s) => s.description)
      .sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0))[0];

    // Runtime: median
    const runtimes = sortedSources
      .map((s) => s.runtime)
      .filter((r): r is number => r !== undefined);
    const medianRuntime =
      runtimes.length > 0
        ? runtimes.sort((a, b) => a - b)[Math.floor(runtimes.length / 2)]
        : undefined;

    const aggregated: AggregatedSceneMetadata = {
      title: titleVotes.value,
      originalTitle: sortedSources.find((s) => s.originalTitle)?.originalTitle,
      releaseDate: best.releaseDate,
      runtime: medianRuntime ?? best.runtime,
      description: bestDesc?.description ?? best.description,
      categories: this.uniqueStrings(sortedSources.flatMap((s) => s.categories)),
      tags: this.uniqueStrings(sortedSources.flatMap((s) => s.tags)),
      posterUrl: best.posterUrl,
      backdropUrl: best.backdropUrl,
      trailerUrl: sortedSources.find((s) => s.trailerUrl)?.trailerUrl,
      studio: best.studio,
      performers: this.mergePerformers(sortedSources),
      sources: {
        title: this.sourceAttribution(
          titleVotes.source,
          titleVotes.sourceId,
          titleVotes.value
        ),
        description: bestDesc
          ? this.sourceAttribution(bestDesc.source, bestDesc.sourceId, bestDesc.description ?? '')
          : undefined,
        releaseDate: best.releaseDate
          ? this.sourceAttribution(best.source, best.sourceId, best.releaseDate)
          : undefined,
        runtime: medianRuntime
          ? this.sourceAttribution(best.source, best.sourceId, String(medianRuntime))
          : undefined,
        studio: best.studio
          ? this.sourceAttribution(best.source, best.sourceId, best.studio.name)
          : undefined,
        poster: best.posterUrl
          ? this.sourceAttribution(best.source, best.sourceId, best.posterUrl)
          : undefined,
        backdrop: best.backdropUrl
          ? this.sourceAttribution(best.source, best.sourceId, best.backdropUrl)
          : undefined,
        trailer: sortedSources.find((s) => s.trailerUrl)?.trailerUrl
          ? this.sourceAttribution(
              sortedSources.find((s) => s.trailerUrl)!.source,
              sortedSources.find((s) => s.trailerUrl)!.sourceId,
              sortedSources.find((s) => s.trailerUrl)!.trailerUrl ?? ''
            )
          : undefined,
      },
      confidence: this.calculateConfidence(sortedSources),
    };

    return aggregated;
  }

  /** Build aggregated performer from multiple sources. */
  private buildAggregatedPerformer(
    sources: AdultPerformerResult[]
  ): AggregatedPerformerMetadata {
    const best = sources[0];
    const externalIds: Record<string, string> = {};
    for (const s of sources) {
      externalIds[s.source] = s.sourceId;
    }

    return {
      name: best.name,
      aliases: this.uniqueStrings(sources.flatMap((s) => s.aliases)),
      birthDate: best.birthDate,
      bio: sources.find((s) => s.bio)?.bio,
      gender: best.gender,
      imageUrl: best.imageUrl,
      thumbnailUrl: best.thumbnailUrl,
      country: best.country,
      height: best.height,
      weight: best.weight,
      measurements: best.measurements,
      sceneCount: Math.max(...sources.map((s) => s.sceneCount)),
      active: sources.some((s) => s.active),
      popularity: Math.max(...sources.map((s) => s.popularity)),
      externalIds,
    };
  }

  /** Merge performers from multiple sources, deduplicating by name. */
  private mergePerformers(sources: AdultSceneResult[]): AdultPerformerInfo[] {
    const seen = new Map<string, AdultPerformerInfo>();
    for (const source of sources) {
      for (const p of source.performers) {
        const key = p.name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.set(key, p);
        } else {
          const existing = seen.get(key)!;
          // Enrich with data from new source
          if (!existing.externalId && p.externalId) existing.externalId = p.externalId;
          if (!existing.imageUrl && p.imageUrl) existing.imageUrl = p.imageUrl;
          if (!existing.gender && p.gender) existing.gender = p.gender;
        }
      }
    }
    return Array.from(seen.values());
  }

  /** Calculate confidence scores based on provider agreement. */
  private calculateConfidence(sources: AdultSceneResult[]): ConfidenceScore {
    if (sources.length === 0) {
      return {
        overall: 0,
        title: 0,
        description: 0,
        performers: 0,
        studio: 0,
        tags: 0,
        releaseDate: 0,
        poster: 0,
      };
    }

    // More providers = higher overall confidence
    const baseConfidence = Math.min(sources.length / 3, 1.0) * 0.7;

    // Field-level: how many agree?
    const titles = new Set(sources.map((s) => s.title.toLowerCase().trim()));
    const titleConfidence = 1 - (titles.size - 1) / Math.max(sources.length, 1);

    const studios = new Set(
      sources.filter((s) => s.studio).map((s) => s.studio!.name.toLowerCase().trim())
    );
    const studioConfidence = studios.size === 0
      ? 0
      : 1 - (studios.size - 1) / Math.max(sources.filter((s) => s.studio).length, 1);

    const hasDescription = sources.filter((s) => s.description).length;
    const descConfidence = hasDescription / Math.max(sources.length, 1);

    const hasReleaseDate = sources.filter((s) => s.releaseDate).length;
    const releaseConfidence = hasReleaseDate / Math.max(sources.length, 1);

    const hasPoster = sources.filter((s) => s.posterUrl).length;
    const posterConfidence = hasPoster / Math.max(sources.length, 1);

    const perfCounts = sources.map((s) => s.performers.length);
    const performerConfidence = sources.length > 1
      ? 1 - Math.abs(perfCounts[0] - (perfCounts[1] ?? perfCounts[0])) / Math.max(Math.max(...perfCounts), 1)
      : 0.5;

    const tagConfidence = Math.min(sources.length / 2, 1.0);

    const overall =
      (titleConfidence * 0.25 +
        descConfidence * 0.15 +
        performerConfidence * 0.2 +
        studioConfidence * 0.15 +
        tagConfidence * 0.1 +
        releaseConfidence * 0.1 +
        posterConfidence * 0.05) *
      0.7 +
      baseConfidence * 0.3;

    return {
      overall: Math.round(overall * 100) / 100,
      title: Math.round(titleConfidence * 100) / 100,
      description: Math.round(descConfidence * 100) / 100,
      performers: Math.round(performerConfidence * 100) / 100,
      studio: Math.round(studioConfidence * 100) / 100,
      tags: Math.round(tagConfidence * 100) / 100,
      releaseDate: Math.round(releaseConfidence * 100) / 100,
      poster: Math.round(posterConfidence * 100) / 100,
    };
  }

  /** Vote on the best value for a field across providers. */
  private fieldVote(
    values: { value: string; source: AdultMetadataSource; sourceId: string; confidence: number }[]
  ): { value: string; source: AdultMetadataSource; sourceId: string } {
    // Count occurrences
    const counts = new Map<string, { count: number; source: AdultMetadataSource; sourceId: string; weight: number }>();
    for (const v of values) {
      const norm = v.value.toLowerCase().trim();
      const existing = counts.get(norm);
      if (existing) {
        existing.count++;
        existing.weight += v.confidence;
      } else {
        counts.set(norm, {
          count: 1,
          source: v.source,
          sourceId: v.sourceId,
          weight: v.confidence,
        });
      }
    }

    // Return the value with highest weighted count
    let best = values[0];
    let bestScore = 0;

    for (const [, entry] of counts) {
      const score = entry.count * entry.weight;
      if (score > bestScore) {
        bestScore = score;
        best = { value: '', source: entry.source, sourceId: entry.sourceId };
      }
    }

    // Get the actual value string from the winning entry
    const winner = Array.from(counts.entries()).sort(
      (a, b) => b[1].count * b[1].weight - a[1].count * a[1].weight
    )[0];

    // Find original value
    const orig = values.find((v) => v.source === winner[1].source);
    return {
      value: orig?.value ?? '',
      source: winner[1].source,
      sourceId: winner[1].sourceId,
    };
  }

  /** Unique string array helper. */
  private uniqueStrings<T>(arr: T[]): T[] {
    return [...new Set(arr)];
  }

  /** Create a source attribution entry. */
  private sourceAttribution(
    source: AdultMetadataSource,
    sourceId: string,
    sourceUrl?: string
  ): MetadataSource {
    return {
      source,
      sourceId,
      sourceUrl,
      confidence: (this.providers[source]?.priority ?? 50) / 100,
    };
  }
}

// Singleton instance
const metadataAggregator = new MetadataAggregator();

export { MetadataAggregator, nameSimilarity };
export default metadataAggregator;
