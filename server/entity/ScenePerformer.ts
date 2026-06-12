import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PerformerRole } from '@server/constants/content';
import Performer from './Performer';
import type Scene from './Scene';

/**
 * Junction entity for the many-to-many relationship between Scene and Performer.
 * Includes the performer's role and ordering within the scene.
 */
@Entity()
@Index(['scene', 'performer'], { unique: true })
class ScenePerformer {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne('Scene', 'scenePerformers', { onDelete: 'CASCADE' })
  @Index()
  public scene: Scene;

  @Column({ type: 'int' })
  public sceneId: number;

  @ManyToOne(() => Performer, (performer) => performer.scenePerformers, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @Index()
  public performer: Performer;

  @Column({ type: 'int' })
  public performerId: number;

  /** Role the performer played in this scene. */
  @Column({ type: 'varchar', default: PerformerRole.STARRING })
  public role: PerformerRole;

  /** Display order in the cast list (lower = first). */
  @Column({ type: 'int', default: 0 })
  public sortOrder: number;

  /** Character name if applicable (e.g., for narrative films). */
  @Column({ type: 'varchar', nullable: true })
  public characterName?: string;

  @CreateDateColumn()
  public createdAt: Date;

  constructor(init?: Partial<ScenePerformer>) {
    Object.assign(this, init);
  }
}

export default ScenePerformer;
