import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { MediaRequest } from './MediaRequest';

@Entity()
class RequestRetry {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public requestId: number;
  @ManyToOne(() => MediaRequest) public request: MediaRequest;
  @Column({ default: 0 }) public attemptCount: number;
  @Column({ default: 0 }) public maxAttempts: number;
  @Column({ type: 'datetime', nullable: true }) public nextRetryAt: Date;
  @Column({ type: 'text', nullable: true }) public lastError: string;
  @Column({ default: false }) public resolved: boolean;
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<RequestRetry>) { Object.assign(this, init); }
}
export default RequestRetry;
