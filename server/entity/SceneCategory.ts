import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import Scene from './Scene';

/**
 * SceneCategory — normalized join table for content categories.
 *
 * Replaces the comma-separated `categories` varchar column on the Scene
 * entity. Enables proper indexed querying, referential integrity, and
 * efficient faceted filtering without LIKE/STRING_SPLIT hacks.
 *
 * Created as part of improvements to Phase 1's content model.
 */
@Entity('scene_category')
@Index(['scene', 'category'], { unique: true })
class SceneCategory {
  @PrimaryGeneratedColumn()
  public id: number;

  @ManyToOne(() => Scene, { onDelete: 'CASCADE' })
  @Index()
  public scene: Scene;

  @Column({ type: 'int' })
  public sceneId: number;

  /** ContentCategory enum value (e.g., 'western', 'jav', 'hentai'). */
  @Column({ type: 'varchar' })
  @Index()
  public category: string;

  @CreateDateColumn()
  public createdAt: Date;

  constructor(init?: Partial<SceneCategory>) {
    Object.assign(this, init);
  }
}

export default SceneCategory;
