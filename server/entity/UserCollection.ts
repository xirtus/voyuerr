import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import User from './User';

@Entity()
class UserCollection {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() public name: string;
  @Column({ type: 'text', nullable: true }) public description: string;
  @Column({ default: false }) public isPublic: boolean;
  @Column({ type: 'text', nullable: true }) public sceneIds: string; // JSON array
  @Column({ default: 0 }) public followerCount: number;
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<UserCollection>) { Object.assign(this, init); }
}
export default UserCollection;
