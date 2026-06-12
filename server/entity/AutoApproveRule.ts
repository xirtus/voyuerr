import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** Phase 11 — Auto-approval rules for request automation. */
@Entity()
class AutoApproveRule {
  @PrimaryGeneratedColumn() public id: number;
  @Column({ default: true }) @Index() public enabled: boolean;
  @Column() public name: string;
  @Column({ type: 'text', nullable: true }) public categories: string; // comma-sep
  @Column({ type: 'text', nullable: true }) public performerIds: string; // comma-sep
  @Column({ type: 'text', nullable: true }) public studioIds: string; // comma-sep
  @Column({ type: 'text', nullable: true }) public qualityIds: string; // comma-sep
  @Column({ default: 0 }) public minRequestCount: number;
  @Column({ default: 0 }) public priority: number;
  /** Auto-upgrade to 4K/VR when available. */
  @Column({ default: false }) public autoUpgrade4k: boolean;
  @Column({ default: false }) public autoUpgradeVR: boolean;
  @CreateDateColumn() public createdAt: Date;
  @UpdateDateColumn() public updatedAt: Date;
  constructor(init?: Partial<AutoApproveRule>) { Object.assign(this, init); }
}
export default AutoApproveRule;
