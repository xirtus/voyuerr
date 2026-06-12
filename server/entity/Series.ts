import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentCategory, SceneStatus } from '@server/constants/content';
import SeriesScene from './SeriesScene';
import Studio from './Studio';
import type Watchlist from './Watchlist';

/**
 * A Series groups related scenes into an ordered collection of releases.
 * Replaces the TV/Season paradigm from traditional media.
 *
 * For example:
 * - "Tushy Raw" (all V1–V99 releases)
 * - "Blacked Raw" series
 * - A JAV series with multiple volumes
 * - A hentai OVA series
 *
 * Renamed from "Collection" to "Series" to avoid confusion with UserCollection
 * (user-curated sets) and TMDB movie collections.
 */
@Entity('series')
class Series {
  @PrimaryGeneratedColumn()
  public id: number;

  /** Series title. */
  @Column({ type: 'varchar' })
  @Index()
  public title: string;

  /** Original title. */
  @Column({ type: 'varchar', nullable: true })
  public originalTitle?: string;

  /** Description / synopsis of the entire series. */
  @Column({ type: 'text', nullable: true })
  public description?: string;

  /** Primary external metadata ID. */
  @Column({ type: 'varchar' })
  @Index()
  public externalId: string;

  /** Slug for the external metadata source. */
  @Column({ type: 'varchar' })
  public externalSource: string;

  /** Additional external IDs (JSON). */
  @Column({ type: 'text', nullable: true })
  public externalIds?: string;

  /** Content categories (comma-separated). */
  @Column({ type: 'varchar', nullable: true })
  public categories?: string;

  /** Poster image URL. */
  @Column({ type: 'varchar', nullable: true })
  public posterUrl?: string;

  /** Backdrop image URL. */
  @Column({ type: 'varchar', nullable: true })
  public backdropUrl?: string;

  /** First release date in the series. */
  @Column({ type: 'varchar', nullable: true })
  public firstReleaseDate?: string;

  /** Latest release date in the series. */
  @Column({ type: 'varchar', nullable: true })
  public lastReleaseDate?: string;

  /** Studio that produces this series. */
  @ManyToOne(() => Studio, { nullable: true, eager: true })
  @Index()
  public studio?: Studio;

  @Column({ type: 'int', nullable: true })
  public studioId?: number;

  /** Total number of scenes in this series (denormalized). */
  @Column({ type: 'int', default: 0 })
  public totalScenes: number;

  /** Availability status (1080p/SD). */
  @Column({ type: 'int', default: SceneStatus.UNKNOWN })
  @Index()
  public status: SceneStatus;

  /** Availability status (4K/VR). */
  @Column({ type: 'int', default: SceneStatus.UNKNOWN })
  @Index()
  public status4k: SceneStatus;

  /** Whether this series is still releasing new scenes. */
  @Column({ type: 'boolean', default: false })
  public isOngoing: boolean;

  /** Popularity score. */
  @Column({ type: 'float', default: 0 })
  public popularity: number;

  /** Scenes in this series (ordered via SeriesScene.order). */
  @OneToMany(() => SeriesScene, (ss) => ss.series, {
    cascade: ['insert', 'remove'],
    eager: true,
  })
  public seriesScenes: SeriesScene[];

  /** Watchlist entries. */
  @OneToMany('Watchlist', 'series')
  public watchlists: null | Watchlist[];

  /** Whisparr service ID (1080p/SD). */
  @Column({ nullable: true, type: 'int' })
  public serviceId?: number | null;

  /** Whisparr service ID (4K). */
  @Column({ nullable: true, type: 'int' })
  public serviceId4k?: number | null;

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<Series>) {
    Object.assign(this, init);
  }

  /** Get parsed categories as an array. */
  public get categoryList(): ContentCategory[] {
    if (!this.categories) return [];
    return this.categories
      .split(',')
      .map((c) => c.trim() as ContentCategory)
      .filter(Boolean);
  }

  /** Get sorted scenes by their series order. */
  public get sortedScenes(): SeriesScene[] {
    if (!this.seriesScenes) return [];
    return [...this.seriesScenes].sort((a, b) => a.order - b.order);
  }
}

export default Series;
