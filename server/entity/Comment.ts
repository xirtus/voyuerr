import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import User from './User';

@Entity()
class Comment {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() @Index() public sceneId: number;
  @Column({ type: 'int', nullable: true }) public parentId: number;
  @Column({ type: 'text' }) public body: string;
  @Column({ default: 0 }) public upvotes: number;
  @Column({ default: 0 }) public downvotes: number;
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<Comment>) { Object.assign(this, init); }
}
export default Comment;
