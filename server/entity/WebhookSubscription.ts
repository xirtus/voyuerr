import {
  Column, CreateDateColumn, Entity, Index,
  ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn
} from 'typeorm';
import { User } from './User';

export enum WebhookEvent {
  REQUEST_CREATED = 'request.created',
  REQUEST_APPROVED = 'request.approved',
  REQUEST_DECLINED = 'request.declined',
  REQUEST_AVAILABLE = 'request.available',
  REQUEST_FAILED = 'request.failed',
  DOWNLOAD_COMPLETE = 'download.complete',
  DOWNLOAD_FAILED = 'download.failed',
  MEDIA_ADDED = 'media.added',
  MEDIA_REMOVED = 'media.removed',
  ISSUE_CREATED = 'issue.created',
  ISSUE_RESOLVED = 'issue.resolved',
}

@Entity('webhook_subscription')
class WebhookSubscription {
  @PrimaryGeneratedColumn() public id: number;

  @Column() @Index() public userId: number;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) public user: User;

  @Column() public name: string;
  @Column() public url: string;

  /** Comma-separated WebhookEvent values. */
  @Column({ type: 'text' }) public events: string;

  /** HMAC-SHA256 secret for payload signing. */
  @Column({ type: 'varchar', nullable: true }) public secret?: string;

  @Column({ default: true }) public enabled: boolean;

  /** Stats */
  @Column({ type: 'int', default: 0 }) public successCount: number;
  @Column({ type: 'int', default: 0 }) public failureCount: number;
  @Column({ type: 'datetime', nullable: true }) public lastDeliveryAt?: Date;
  @Column({ type: 'text', nullable: true }) public lastError?: string;

  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;

  constructor(init?: Partial<WebhookSubscription>) { Object.assign(this, init); }

  get eventList(): WebhookEvent[] {
    return this.events.split(',').map(e => e.trim() as WebhookEvent).filter(Boolean);
  }
}
export default WebhookSubscription;
