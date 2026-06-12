import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import User from './User';

@Entity()
@Index(['userId', 'sceneId'], { unique: true })
class WatchHistory {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() @Index() public sceneId: number;
  @Column({ default: false }) public watched: boolean;
  @Column({ type: 'int', nullable: true }) public resumePosition: number; // seconds
  @Column({ type: 'int', default: 1 }) public playCount: number;
  @Column({ type: 'datetime', nullable: true }) public lastWatchedAt: Date;
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<WatchHistory>) { Object.assign(this, init); }
}
export default WatchHistory;
