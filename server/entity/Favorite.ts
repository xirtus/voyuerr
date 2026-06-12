import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import User from './User';

@Entity()
@Index(['userId', 'entityType', 'entityId'], { unique: true })
class Favorite {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() public entityType: string; // 'scene' | 'performer' | 'studio'
  @Column() public entityId: number;
  @CreateDateColumn() public createdAt: Date;
  constructor(init?: Partial<Favorite>) { Object.assign(this, init); }
}
export default Favorite;
