import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import User from './User';

/** Phase 12 — Activity feed entry. */
@Entity()
class ActivityFeed {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() public type: string; // 'request' | 'rating' | 'review' | 'collection' | 'watch' | 'favorite'
  @Column({ type: 'text' }) public data: string; // JSON payload
  @Column({ default: 'public' }) public visibility: string;
  @CreateDateColumn() @Index() public createdAt: Date;
  constructor(init?: Partial<ActivityFeed>) { Object.assign(this, init); }
}
export default ActivityFeed;
