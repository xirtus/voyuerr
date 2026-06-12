import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import User from './User';

@Entity()
@Index(['userId', 'sceneId'], { unique: true })
class Review {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() @Index() public sceneId: number;
  @Column({ type: 'text' }) public body: string;
  @Column({ default: false }) public hasSpoilers: boolean;
  @Column({ default: 0 }) public upvotes: number;
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<Review>) { Object.assign(this, init); }
}
export default Review;
