import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Series from './Series';
import Scene from './Scene';

/**
 * Junction entity for the many-to-many relationship between Series and Scene.
 * Includes ordering so series can maintain a specific release sequence.
 */
@Entity('series_scene')
@Index(['series', 'scene'], { unique: true })
class SeriesScene {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => Series, (series) => series.seriesScenes, {
    onDelete: 'CASCADE',
  })
  @Index()
  public series: Series;

  @Column({ type: 'int' })
  public seriesId: number;

  @ManyToOne(() => Scene, (scene) => scene.seriesScenes, {
    onDelete: 'CASCADE',
  })
  @Index()
  public scene: Scene;

  @Column({ type: 'int' })
  public sceneId: number;

  /** Position within the series (0-indexed). */
  @Column({ type: 'int', default: 0 })
  public order: number;

  /** Optional label for this entry (e.g., "Vol. 1", "Bonus Scene"). */
  @Column({ type: 'varchar', nullable: true })
  public label?: string;

  @CreateDateColumn()
  public createdAt: Date;

  constructor(init?: Partial<SeriesScene>) {
    Object.assign(this, init);
  }
}

export default SeriesScene;
