import {
  Column, CreateDateColumn, Entity, Index,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';
import { User } from './User';

export enum ApiKeyScope {
  READ_ONLY = 'read_only',
  REQUEST = 'request',
  ADMIN = 'admin',
}

@Entity('api_key')
class ApiKey {
  @PrimaryGeneratedColumn() public id: number;

  @Column() @Index() public userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) public user: User;

  @Column() public name: string;
  @Column() @Index({ unique: true }) public keyHash: string;
  /** Last 4 chars shown in UI for identification. */
  @Column() public keyPrefix: string;

  @Column({ type: 'varchar', default: ApiKeyScope.READ_ONLY })
  public scope: ApiKeyScope;

  @Column({ type: 'int', nullable: true })
  public rateLimitRpm?: number;
  @Column({ type: 'int', nullable: true })
  public rateLimitBurst?: number;

  @Column({ type: 'datetime', nullable: true }) public expiresAt?: Date;
  @Column({ type: 'datetime', nullable: true }) public lastUsedAt?: Date;
  @Column({ type: 'int', default: 0 }) public requestCount: number;

  @Column({ default: true }) public enabled: boolean;

  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;

  constructor(init?: Partial<ApiKey>) { Object.assign(this, init); }
}
export default ApiKey;
