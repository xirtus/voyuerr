import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Phase 13 — Anonymous analytics event (opt-in, zero PII). */
@Entity()
class AnalyticsEvent {
  @PrimaryGeneratedColumn() public id: number;
  @Column() @Index() public eventType: string; // 'request' | 'download' | 'search' | 'view' | 'rating' | 'error'
  @Column({ type: 'text' }) public payload: string; // JSON
  @Column({ default: 'anon' }) public userId: string; // hashed/anonymized
  @CreateDateColumn() @Index() public createdAt: Date;
  constructor(init?: Partial<AnalyticsEvent>) { Object.assign(this, init); }
}
export default AnalyticsEvent;
