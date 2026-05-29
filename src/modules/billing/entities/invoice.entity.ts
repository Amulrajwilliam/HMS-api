import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum InvoiceStatus { PENDING = 'pending', PARTIAL = 'partial', PAID = 'paid', OVERDUE = 'overdue', CANCELLED = 'cancelled' }
export enum PaymentMode { CASH = 'cash', CARD = 'card', UPI = 'upi', NET_BANKING = 'net_banking', INSURANCE = 'insurance' }

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) invoiceNumber: string;

  @ManyToOne(() => Patient, { eager: true }) @JoinColumn() patient: Patient;
  @ManyToOne(() => User, { nullable: true, eager: true }) @JoinColumn() doctor: User;

  @OneToMany('InvoiceItem', 'invoice', { cascade: true, eager: true })
  items: any[]; // Using any[] to avoid circular dependency in initialization

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) subtotal: number;
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 18 }) taxRate: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) taxAmount: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) discount: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) totalAmount: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) paidAmount: number;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.PENDING }) status: InvoiceStatus;
  @Column({ type: 'date', nullable: true }) dueDate: string;
  @Column({ type: 'text', nullable: true }) notes: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  
  @Column() description: string;
  @Column({ type: 'int', default: 1 }) quantity: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) unitPrice: number;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amount: number;

  @Column({ type: 'uuid', nullable: true })
  billableServiceId: string | null;

  @ManyToOne(() => Invoice, invoice => invoice.items, { onDelete: 'CASCADE' })
  invoice: Invoice;
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) receiptNumber: string;
  @ManyToOne(() => Invoice, { eager: true }) @JoinColumn() invoice: Invoice;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amount: number;
  @Column({ type: 'enum', enum: PaymentMode }) mode: PaymentMode;
  @Column({ nullable: true }) transactionRef: string;
  @Column({ nullable: true }) remarks: string;
  @CreateDateColumn() paidAt: Date;
}
