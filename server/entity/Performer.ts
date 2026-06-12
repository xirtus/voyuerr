import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PerformerGender } from '@server/constants/content';
import ScenePerformer from './ScenePerformer';

@Entity()
class Performer {
  @PrimaryGeneratedColumn()
  public id: number;

  /** Primary stage name. */
  @Column({ type: 'varchar' })
  @Index()
  public name: string;

  /** Alternative names / aliases (JSON array of strings). */
  @Column({ type: 'text', nullable: true })
  public aliases?: string;

  /** Date of birth (ISO 8601 date string). */
  @Column({ type: 'varchar', nullable: true })
  public birthDate?: string;

  /** Biography / description. */
  @Column({ type: 'text', nullable: true })
  public bio?: string;

  /** Gender classification. */
  @Column({ type: 'varchar', default: PerformerGender.FEMALE })
  public gender: PerformerGender;

  /** Primary profile image URL. */
  @Column({ type: 'varchar', nullable: true })
  public imageUrl?: string;

  /** Thumbnail image URL. */
  @Column({ type: 'varchar', nullable: true })
  public thumbnailUrl?: string;

  /** External database IDs (JSON: { tpdb, r18, stashdb, javdb, etc. }). */
  @Column({ type: 'text', nullable: true })
  public externalIds?: string;

  /** Country of origin (ISO 3166-1 alpha-2). */
  @Column({ type: 'varchar', nullable: true })
  public country?: string;

  /** Height in cm. */
  @Column({ type: 'int', nullable: true })
  public height?: number;

  /** Weight in kg. */
  @Column({ type: 'int', nullable: true })
  public weight?: number;

  /** Physical measurements (e.g., "34C-24-36"). */
  @Column({ type: 'varchar', nullable: true })
  public measurements?: string;

  /** Number of known scenes (denormalized for performance). */
  @Column({ type: 'int', default: 0 })
  public sceneCount: number;

  /** Whether the performer is active in the industry. */
  @Column({ type: 'boolean', default: true })
  public active: boolean;

  /** Adult content flag — always true for adult performers. */
  @Column({ type: 'boolean', default: true })
  public adult: boolean;

  /** Popularity score from metadata providers. */
  @Column({ type: 'float', default: 0 })
  public popularity: number;

  @OneToMany(() => ScenePerformer, (sp) => sp.performer)
  public scenePerformers: ScenePerformer[];

  @CreateDateColumn()
  public createdAt: Date;

  @UpdateDateColumn()
  public updatedAt: Date;

  constructor(init?: Partial<Performer>) {
    Object.assign(this, init);
  }
}

export default Performer;
