/**
 * A frozen snapshot of a cart at checkout time.
 *
 * An Invoice is immutable on purpose (guide §5). You never edit a saved bill —
 * to correct one you issue a new document. That is what keeps the sales
 * history trustworthy as a financial record.
 */

import { ValidationError } from '../errors/AppError';
import { Money } from './Money';

export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'mobile' | 'other';

export interface InvoiceItemProps {
  id?: number;
  invoiceId?: number;
  productId?: number | null;
  /** Copied at sale time — see the schema rules in guide §6. */
  productName: string;
  barcode: string;
  quantity: number;
  unitPrice: Money;
  discountShare: Money;
  taxRate: number;
  tax: Money;
  lineTotal: Money;
}

export class InvoiceItem {
  readonly id?: number;
  readonly invoiceId?: number;
  readonly productId: number | null;
  readonly productName: string;
  readonly barcode: string;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly discountShare: Money;
  readonly taxRate: number;
  readonly tax: Money;
  readonly lineTotal: Money;

  constructor(props: InvoiceItemProps) {
    if (!props.productName?.trim()) {
      throw new ValidationError('Invoice line needs a product name');
    }
    if (!Number.isInteger(props.quantity) || props.quantity < 1) {
      throw new ValidationError(`Invoice line quantity must be at least 1, got ${props.quantity}`);
    }
    this.id = props.id;
    this.invoiceId = props.invoiceId;
    this.productId = props.productId ?? null;
    this.productName = props.productName.trim();
    this.barcode = props.barcode;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
    this.discountShare = props.discountShare;
    this.taxRate = props.taxRate;
    this.tax = props.tax;
    this.lineTotal = props.lineTotal;
    Object.freeze(this);
  }
}

export interface InvoiceProps {
  id?: number;
  invoiceNo: string;
  customerName?: string | null;
  items: InvoiceItem[];
  subtotal: Money;
  discount: Money;
  tax: Money;
  grandTotal: Money;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  /** Amount handed over. Lets the receipt show change due. */
  amountPaid?: Money;
  cashierId?: number | null;
  cashierName?: string | null;
  createdAt?: string;
  note?: string | null;
}

export class Invoice {
  readonly id?: number;
  readonly invoiceNo: string;
  readonly customerName: string | null;
  readonly items: readonly InvoiceItem[];
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly grandTotal: Money;
  readonly paymentStatus: PaymentStatus;
  readonly paymentMethod: PaymentMethod;
  readonly amountPaid: Money;
  readonly cashierId: number | null;
  readonly cashierName: string | null;
  readonly createdAt: string;
  readonly note: string | null;

  constructor(props: InvoiceProps) {
    if (!props.invoiceNo?.trim()) {
      throw new ValidationError('Invoice number is required');
    }
    if (!props.items || props.items.length === 0) {
      throw new ValidationError('Cannot create an invoice with no items', {
        userMessage: 'Add at least one item before checking out.',
      });
    }

    this.id = props.id;
    this.invoiceNo = props.invoiceNo.trim();
    this.customerName = props.customerName?.trim() || null;
    this.items = Object.freeze([...props.items]);
    this.subtotal = props.subtotal;
    this.discount = props.discount;
    this.tax = props.tax;
    this.grandTotal = props.grandTotal;
    this.paymentStatus = props.paymentStatus;
    this.paymentMethod = props.paymentMethod;
    this.amountPaid = props.amountPaid ?? (props.paymentStatus === 'paid' ? props.grandTotal : 0);
    this.cashierId = props.cashierId ?? null;
    this.cashierName = props.cashierName ?? null;
    this.createdAt = props.createdAt ?? new Date().toISOString();
    this.note = props.note ?? null;

    Object.freeze(this);
  }

  unitCount(): number {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  /** Cash handed over minus what was owed. Zero for exact/card payments. */
  changeDue(): Money {
    return Math.max(0, this.amountPaid - this.grandTotal);
  }

  balanceDue(): Money {
    return Math.max(0, this.grandTotal - this.amountPaid);
  }

  isPaid(): boolean {
    return this.paymentStatus === 'paid';
  }

  /**
   * Re-adds the stored figures and checks they agree with the stored total.
   * A cheap integrity check when loading an old bill off disk.
   */
  isBalanced(): boolean {
    const expected = this.subtotal - this.discount + this.tax;
    return expected === this.grandTotal;
  }

  /** Payment status is the one mutable-ish field; it produces a new Invoice. */
  withPaymentStatus(status: PaymentStatus, amountPaid?: Money): Invoice {
    return new Invoice({
      ...this.toProps(),
      paymentStatus: status,
      amountPaid: amountPaid ?? this.amountPaid,
    });
  }

  toProps(): InvoiceProps {
    return {
      id: this.id,
      invoiceNo: this.invoiceNo,
      customerName: this.customerName,
      items: [...this.items],
      subtotal: this.subtotal,
      discount: this.discount,
      tax: this.tax,
      grandTotal: this.grandTotal,
      paymentStatus: this.paymentStatus,
      paymentMethod: this.paymentMethod,
      amountPaid: this.amountPaid,
      cashierId: this.cashierId,
      cashierName: this.cashierName,
      createdAt: this.createdAt,
      note: this.note,
    };
  }
}
