/**
 * Checkout — the most safety-critical function in the app (guide §8.5).
 *
 * Everything below happens inside ONE exclusive transaction:
 *   1. allocate the next invoice number
 *   2. write the invoice header
 *   3. write every line item
 *   4. decrement stock for each product
 *
 * If any step throws, SQLite rolls the whole thing back. There is no state
 * where stock has been decremented but no bill exists, and because the
 * sequence is allocated inside the same exclusive transaction, two tills
 * cannot mint the same invoice number.
 */

import { getDatabase } from '../data/database';
import { SqliteInvoiceRepository } from '../data/repositories/SqliteInvoiceRepository';
import { SqliteProductRepository } from '../data/repositories/SqliteProductRepository';
import { SqliteSettingsRepository } from '../data/repositories/SqliteSettingsRepository';
import { cartDraftRepository, invoiceRepository } from '../data';
import { Cart } from '../domain/Cart';
import { Invoice, PaymentMethod, PaymentStatus } from '../domain/Invoice';
import { InvoiceFactory } from '../domain/InvoiceFactory';
import { Money } from '../domain/Money';
import { User } from '../domain/User';
import { SETTINGS_KEYS } from '../config/constants';
import { DatabaseError, ValidationError, toAppError } from '../errors/AppError';
import { logger } from '../errors/logger';

export interface CheckoutOptions {
  cashier?: User | null;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  amountPaid?: Money;
  note?: string | null;
  /**
   * Allow selling more units than are recorded in stock. Shops often have
   * stock counts that lag reality, and blocking a real sale at the counter is
   * worse than a temporarily negative count — so this defaults to true and
   * the UI shows a warning instead.
   */
  allowOverSell?: boolean;
}

export class BillingService {
  async checkout(cart: Cart, options: CheckoutOptions = {}): Promise<Invoice> {
    if (cart.isEmpty) {
      throw new ValidationError('Cannot check out an empty cart', {
        userMessage: 'Add at least one item before checking out.',
      });
    }

    const allowOverSell = options.allowOverSell ?? true;
    if (!allowOverSell) {
      const oversold = cart.overSoldItems();
      if (oversold.length > 0) {
        throw new ValidationError(`Insufficient stock for ${oversold.length} item(s)`, {
          userMessage: `Not enough stock for ${oversold[0].name}.`,
        });
      }
    }

    const db = await getDatabase();
    let saved: Invoice | null = null;

    try {
      await db.withExclusiveTransactionAsync(async (txn) => {
        // Repositories bound to the transaction, so every write below either
        // lands together or not at all.
        const invoices = new SqliteInvoiceRepository(txn);
        const products = new SqliteProductRepository(txn);
        const settings = new SqliteSettingsRepository(txn);

        const prefix = (await settings.get(SETTINGS_KEYS.invoicePrefix)) ?? 'INV';
        const sequence = await invoices.nextSequence();
        const invoiceNo = InvoiceFactory.formatInvoiceNo(prefix, sequence);

        const invoice = InvoiceFactory.fromCart(cart, {
          invoiceNo,
          paymentStatus: options.paymentStatus ?? 'paid',
          paymentMethod: options.paymentMethod ?? 'cash',
          amountPaid: options.amountPaid,
          cashierId: options.cashier?.id ?? null,
          cashierName: options.cashier?.name ?? null,
          note: options.note ?? null,
        });

        const persisted = await invoices.create(invoice);

        for (const item of persisted.items) {
          if (item.productId === null) continue; // ad-hoc line, nothing to decrement

          const ok = await products.decrementStock(item.productId, item.quantity);
          if (!ok) {
            if (!allowOverSell) {
              // Throwing here rolls back the invoice we just wrote.
              throw new ValidationError(
                `Stock ran out for "${item.productName}" during checkout`,
                { userMessage: `Not enough stock for ${item.productName}.` },
              );
            }
            // Over-sell permitted: record the shortfall honestly rather than
            // silently leaving stock untouched.
            await txn.runAsync(
              'UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ?',
              [item.quantity, new Date().toISOString(), item.productId],
            );
            logger.warn('Sold below recorded stock', {
              product: item.productName,
              quantity: item.quantity,
            });
          }
        }

        saved = persisted;
      });
    } catch (error) {
      logger.error('Checkout failed and was rolled back', error, {
        itemCount: cart.items.length,
        grandTotal: cart.grandTotal(),
      });
      const appError = toAppError(error);
      // Preserve a ValidationError's specific message; anything else is a
      // genuine storage failure.
      if (appError instanceof ValidationError) throw appError;
      throw new DatabaseError('Checkout transaction failed', { cause: error });
    }

    if (!saved) {
      throw new DatabaseError('Checkout completed without producing an invoice');
    }

    // The sale is committed. Clearing the draft is best-effort — failing here
    // must not make a successful sale look failed.
    try {
      await cartDraftRepository.clear();
    } catch (error) {
      logger.warn('Could not clear cart draft after checkout', { error: String(error) });
    }

    logger.info('Checkout complete', {
      invoiceNo: saved.invoiceNo,
      grandTotal: saved.grandTotal,
    });
    return saved;
  }

  /** Marks an unpaid/partial bill as settled. */
  async markAsPaid(invoiceId: number, amountPaid?: Money): Promise<void> {
    await invoiceRepository.updatePaymentStatus(invoiceId, 'paid', amountPaid);
  }

  async markAsRefunded(invoiceId: number): Promise<void> {
    await invoiceRepository.updatePaymentStatus(invoiceId, 'refunded');
  }
}

export const billingService = new BillingService();
