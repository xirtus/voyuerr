import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import User from './User';

@Entity()
@Index(['followerId', 'followingId'], { unique: true })
class UserFollow {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public followerId: number;
  @ManyToOne(() => User) public follower: User;
  @Column() @Index() public followingId: number;
  @ManyToOne(() => User) public following: User;
  @CreateDateColumn() public createdAt: Date;
  constructor(init?: Partial<UserFollow>) { Object.assign(this, init); }
}
export default UserFollow;
