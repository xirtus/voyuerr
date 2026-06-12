import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import WebhookSubscription from './WebhookSubscription';

@Entity('webhook_delivery')
class WebhookDelivery {
  @PrimaryGeneratedColumn() public id: number;

  @Column() @Index() public subscriptionId: number;
  @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE' })
  public subscription: WebhookSubscription;

  @Column() public event: string;
  @Column() public success: boolean;
  @Column({ type: 'int', default: 0 }) public responseStatus: number;
  @Column({ type: 'int', default: 1 }) public attempt: number;
  @Column({ type: 'text', nullable: true }) public error?: string;

  @CreateDateColumn() @Index() public createdAt: Date;

  constructor(init?: Partial<WebhookDelivery>) { Object.assign(this, init); }
}
export default WebhookDelivery;
