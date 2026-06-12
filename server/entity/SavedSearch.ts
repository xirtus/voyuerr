import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import User from './User';

/** Phase 9 — Saved search with facet state. */
@Entity()
class SavedSearch {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public userId: number;
  @ManyToOne(() => User) public user: User;
  @Column() public name: string;
  @Column({ type: 'text' }) public query: string; // JSON: { query, facets, sort }
  @Column({ default: false }) public isDefault: boolean;
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<SavedSearch>) { Object.assign(this, init); }
}
export default SavedSearch;
