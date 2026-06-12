import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import User from './User';

/** Phase 10 — Per-user scene rating (1–5 stars). */
@Entity()
@Index(['userId', 'sceneId'], { unique: true })
class Rating {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() @Index() public sceneId: number;
  @Column({ type: 'int' }) public score: number; // 1–5
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<Rating>) { Object.assign(this, init); }
}
export default Rating;
