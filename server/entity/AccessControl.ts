import {
  Column, CreateDateColumn, Entity, Index,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';
import { User } from './User';

/** Types of library access grants. */
export enum LibraryAccessLevel {
  NONE = 'none',
  READ = 'read',
  REQUEST = 'request',
  MANAGE = 'manage',
}

/**
 * Per-library access control.
 *
 * Grants or denies access to specific Jellyfin/Plex libraries on a per-user basis.
 * Phase 23 — Advanced Access Control
 */
@Entity('library_access')
@Index(['userId', 'libraryId'], { unique: true })
class LibraryAccess {
  @PrimaryGeneratedColumn() public id: number;

  @Column() @Index() public userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) public user: User;

  /** Library identifier (Jellyfin library ID, Plex section ID, etc.). */
  @Column() public libraryId: string;
  @Column({ type: 'varchar', default: LibraryAccessLevel.READ })
  public accessLevel: LibraryAccessLevel;

  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;

  constructor(init?: Partial<LibraryAccess>) { Object.assign(this, init); }
}

/**
 * Guest / temporary access tokens.
 *
 * Time-limited, request-limited access for non-permanent users.
 * Phase 23 — Advanced Access Control
 */
@Entity('guest_token')
class GuestToken {
  @PrimaryGeneratedColumn() public id: number;

  @Column() @Index() public userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) public user: User;

  @Column() @Index({ unique: true }) public token: string;
  @Column() public name: string;

  @Column({ type: 'datetime', nullable: true }) public expiresAt?: Date;
  @Column({ type: 'int', default: 10 }) public maxRequests: number;
  @Column({ type: 'int', default: 0 }) public usedRequests: number;

  @Column({ default: true }) public enabled: boolean;

  @CreateDateColumn() public createdAt: Date;

  constructor(init?: Partial<GuestToken>) { Object.assign(this, init); }

  get isExpired(): boolean {
    if (this.expiresAt && new Date(this.expiresAt) < new Date()) return true;
    if (this.usedRequests >= this.maxRequests) return true;
    return !this.enabled;
  }
}

export { LibraryAccess, GuestToken };
