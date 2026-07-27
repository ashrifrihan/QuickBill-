/**
 * The single place an Invoice is built from a Cart (Factory pattern, guide §5).
 *
 * Keeping this in one function means the rules for turning a live cart into a
 * permanent financial record — which figures get copied, how lines are frozen,
 * how the number is formatted — exist exactly once.
 */

import { Cart } from './Cart';
import { Invoice, InvoiceItem, PaymentMethod, PaymentStatus } from './Invoice';
import { Money } from './Money';
import { ValidationError } from '../errors/AppError';

export interface CreateInvoiceOptions {
  invoiceNo: string;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  amountPaid?: Money;
  cashierId?: number | null;
  cashierName?: string | null;
  note?: string | null;
  /** Injectable for deterministic tests. */
  now?: () => Date;
}

export const InvoiceFactory = {
  fromCart(cart: Cart, options: CreateInvoiceOptions): Invoice {
    if (cart.isEmpty) {
      throw new ValidationError('Cannot check out an empty cart', {
        userMessage: 'Add at least one item before checking out.',
      });
    }

    // One computation, reused for the invoice header AND every line, so the
    // parts are guaranteed to add up to the whole.
    const totals = cart.totals();

    const items = totals.lines.map(
      (line) =>
        new InvoiceItem({
          productId: line.item.productId ?? null,
          productName: line.item.name,
          barcode: line.item.barcode,
          quantity: line.item.quantity,
          unitPrice: line.item.unitPrice,
          discountShare: line.discountShare,
          taxRate: line.item.taxRate,
          tax: line.tax,
          lineTotal: line.lineTotal,
        }),
    );

    const now = options.now?.() ?? new Date();

    return new Invoice({
      invoiceNo: options.invoiceNo,
      customerName: cart.customerName,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      grandTotal: totals.grandTotal,
      paymentStatus: options.paymentStatus ?? 'paid',
      paymentMethod: options.paymentMethod ?? 'cash',
      amountPaid: options.amountPaid,
      cashierId: options.cashierId ?? null,
      cashierName: options.cashierName ?? null,
      createdAt: now.toISOString(),
      note: options.note ?? null,
    });
  },

  /**
   * Formats a sequence number as `INV-20260727-0007`.
   * The sequence itself is allocated inside the checkout transaction
   * (guide §8.5) — this only formats it.
   */
  formatInvoiceNo(prefix: string, sequence: number, date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${prefix}-${y}${m}${d}-${String(sequence).padStart(4, '0')}`;
  },
};
