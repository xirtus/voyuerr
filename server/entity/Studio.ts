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
import { StudioNetworkType } from '@server/constants/content';
import type Scene from './Scene';

@Entity()
class Studio {
  @PrimaryGeneratedColumn()
  public id: number;

  /** Studio/network display name. */
  @Column({ type: 'varchar' })
  @Index()
  public name: string;

  /** URL-safe slug for routing. */
  @Column({ type: 'varchar', unique: true })
  @Index()
  public slug: string;

  /** Description / about text. */
  @Column({ type: 'text', nullable: true })
  public description?: string;

  /** Logo image URL. */
  @Column({ type: 'varchar', nullable: true })
  public logoUrl?: string;

  /** Banner/backdrop image URL. */
  @Column({ type: 'varchar', nullable: true })
  public backdropUrl?: string;

  /** Official website URL. */
  @Column({ type: 'varchar', nullable: true })
  public websiteUrl?: string;

  /** Parent studio ID (for network/subsidiary relationships). */
  @Column({ type: 'int', nullable: true })
  @Index()
  public parentStudioId?: number;

  /** Relationship type within the network. */
  @Column({ type: 'varchar', default: StudioNetworkType.INDEPENDENT })
  public networkType: StudioNetworkType;

  /** Country of origin (ISO 3166-1 alpha-2). */
  @Column({ type: 'varchar', nullable: true })
  public country?: string;

  /** Year the studio was founded. */
  @Column({ type: 'int', nullable: true })
  public foundedYear?: number;

  /** External database IDs (JSON: { tpdb, r18, stashdb, etc. }). */
  @Column({ type: 'text', nullable: true })
  public externalIds?: string;

  /** Number of scenes (denormalized for performance). */
  @Column({ type: 'int', default: 0 })
  public sceneCount: number;

  /** Popularity score from metadata providers. */
  @Column({ type: 'float', default: 0 })
  public popularity: number;

  @ManyToOne(() => Studio, (studio) => studio.childStudios, { nullable: true })
  public parentStudio?: Studio;

  @OneToMany(() => Studio, (studio) => studio.parentStudio)
  public childStudios: Studio[];

  @OneToMany('Scene', 'studio')
  public scenes: Scene[];

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<Studio>) {
    Object.assign(this, init);
  }
}

export default Studio;
