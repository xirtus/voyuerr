import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ContentCategory,
  ContentType,
  SceneStatus,
} from '@server/constants/content';
import type SeriesScene from './SeriesScene';
import ScenePerformer from './ScenePerformer';
import Studio from './Studio';
import type Watchlist from './Watchlist';

@Entity()
@Index(['externalId', 'contentType'])
class Scene {
  @PrimaryGeneratedColumn()
  public id: number;

  /** Content type classification. */
  @Column({ type: 'varchar' })
  public contentType: ContentType;

  /** Primary title. */
  @Column({ type: 'varchar' })
  @Index()
  public title: string;

  /** Original title (non-English / JAV romanization). */
  @Column({ type: 'varchar', nullable: true })
  public originalTitle?: string;

  /** Release date (ISO 8601 date string). */
  @Column({ type: 'varchar', nullable: true })
  public releaseDate?: string;

  /** Release year (denormalized for filtering). */
  @Column({ type: 'int', nullable: true })
  public releaseYear?: number;

  /** Runtime in minutes. */
  @Column({ type: 'int', nullable: true })
  public runtime?: number;

  /** Description / synopsis. */
  @Column({ type: 'text', nullable: true })
  public description?: string;

  /** Primary external metadata ID (ThePornDB scene ID, R18 ID, etc.). */
  @Column({ type: 'varchar' })
  @Index()
  public externalId: string;

  /** Slug for the external metadata source (e.g., 'tpdb', 'r18', 'javdb'). */
  @Column({ type: 'varchar' })
  public externalSource: string;

  /** Additional external IDs (JSON: { tpdb: '123', r18: 'abc-456', imdb: 'tt...' }). */
  @Column({ type: 'text', nullable: true })
  public externalIds?: string;

  /** Content categories (comma-separated ContentCategory enum values). */
  @Column({ type: 'varchar', nullable: true })
  public categories?: string;

  /** Tags / keywords (comma-separated). */
  @Column({ type: 'text', nullable: true })
  public tags?: string;

  /** Poster/cover image URL. */
  @Column({ type: 'varchar', nullable: true })
  public posterUrl?: string;

  /** Backdrop/fanart image URL. */
  @Column({ type: 'varchar', nullable: true })
  public backdropUrl?: string;

  /** Trailer URL. */
  @Column({ type: 'varchar', nullable: true })
  public trailerUrl?: string;

  /** Availability status (1080p/SD). */
  @Column({ type: 'int', default: SceneStatus.UNKNOWN })
  @Index()
  public status: SceneStatus;

  /** Availability status (4K/VR). */
  @Column({ type: 'int', default: SceneStatus.UNKNOWN })
  @Index()
  public status4k: SceneStatus;

  /** Studio that produced this scene. */
  @ManyToOne(() => Studio, (studio) => studio.scenes, {
    nullable: true,
    eager: true,
  })
  @Index()
  public studio?: Studio;

  @Column({ type: 'int', nullable: true })
  public studioId?: number;

  /** Performers in this scene (M2M via ScenePerformer). */
  @OneToMany(() => ScenePerformer, (sp) => sp.scene, {
    cascade: ['insert', 'remove'],
    eager: true,
  })
  public scenePerformers: ScenePerformer[];

  /** Series memberships (M2M via SeriesScene). */
  @OneToMany('SeriesScene', 'scene')
  public seriesScenes: SeriesScene[];

  /** Watchlist entries. */
  @OneToMany('Watchlist', 'scene')
  public watchlists: null | Watchlist[];

  /** Whisparr service ID (1080p/SD instance). */
  @Column({ nullable: true, type: 'int' })
  public serviceId?: number | null;

  /** Whisparr service ID (4K instance). */
  @Column({ nullable: true, type: 'int' })
  public serviceId4k?: number | null;

  /** Whisparr internal movie ID (1080p/SD). */
  @Column({ nullable: true, type: 'int' })
  public externalServiceId?: number | null;

  /** Whisparr internal movie ID (4K). */
  @Column({ nullable: true, type: 'int' })
  public externalServiceId4k?: number | null;

  /** Whisparr title slug (1080p/SD). */
  @Column({ nullable: true, type: 'varchar' })
  public externalServiceSlug?: string | null;

  /** Whisparr title slug (4K). */
  @Column({ nullable: true, type: 'varchar' })
  public externalServiceSlug4k?: string | null;

  /** Jellyfin media ID (1080p/SD). */
  @Column({ nullable: true, type: 'varchar' })
  public jellyfinMediaId?: string | null;

  /** Jellyfin media ID (4K). */
  @Column({ nullable: true, type: 'varchar' })
  public jellyfinMediaId4k?: string | null;

  /** Plex rating key (1080p/SD). */
  @Column({ nullable: true, type: 'varchar' })
  public ratingKey?: string | null;

  /** Plex rating key (4K). */
  @Column({ nullable: true, type: 'varchar' })
  public ratingKey4k?: string | null;

  /** Date media was added to library. */
  @Column({ type: 'datetime', nullable: true })
  public mediaAddedAt?: Date;

  /** Computed URLs (not persisted). */
  public mediaUrl?: string;
  public mediaUrl4k?: string;
  public serviceUrl?: string;
  public serviceUrl4k?: string;
  public downloadStatus?: unknown[];

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<Scene>) {
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

  /** Get parsed tags as an array. */
  public get tagList(): string[] {
    if (!this.tags) return [];
    return this.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  /** Get sorted performers (by sortOrder). */
  public get performers(): ScenePerformer[] {
    if (!this.scenePerformers) return [];
    return [...this.scenePerformers].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /** Reset service integration data. */
  public resetServiceData(): void {
    this.serviceId = null;
    this.serviceId4k = null;
    this.externalServiceId = null;
    this.externalServiceId4k = null;
    this.externalServiceSlug = null;
    this.externalServiceSlug4k = null;
    this.ratingKey = null;
    this.ratingKey4k = null;
    this.jellyfinMediaId = null;
    this.jellyfinMediaId4k = null;
  }
}

export default Scene;
