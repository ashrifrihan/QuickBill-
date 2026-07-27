/**
 * Bridges BillingService + PrinterService to the checkout screens, so those
 * screens stay "dumb": they render what this returns and call its actions
 * (guide §5, hooks as the UI bridge).
 */

import { useCallback, useState } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { billingService } from '../../services/BillingService';
import { printerService, PrinterStrategyId, PrintResult } from '../../services/PrinterService';
import { reportService } from '../../services/ReportService';
import { settingsService } from '../../services/SettingsService';
import { Invoice, PaymentMethod, PaymentStatus } from '../../domain/Invoice';
import { Money } from '../../domain/Money';
import { toAppError } from '../../errors/AppError';
import { logger } from '../../errors/logger';

export interface CheckoutInput {
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  amountPaid?: Money;
  note?: string | null;
}

export function useCheckout() {
  const cart = useCartStore((state) => state.cart);
  const clearCart = useCartStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const settings = useSettingsStore((state) => state.settings);

  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  /**
   * Saves the sale. Only clears the cart once the transaction has committed —
   * if checkout fails the cashier still has their cart.
   */
  const checkout = useCallback(
    async (input: CheckoutInput): Promise<Invoice | null> => {
      setSubmitting(true);
      setError(null);
      try {
        const saved = await billingService.checkout(cart, {
          cashier: user,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          amountPaid: input.amountPaid,
          note: input.note,
        });

        setInvoice(saved);
        clearCart();
        reportService.invalidate();
        return saved;
      } catch (err) {
        const appError = toAppError(err);
        setError(appError.userMessage);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [cart, user, clearCart],
  );

  /**
   * Printing is deliberately separate from checkout. The sale is already
   * saved by this point, so a printer failure is an inconvenience, never a
   * lost transaction.
   */
  const print = useCallback(
    async (target: Invoice, strategy?: PrinterStrategyId): Promise<PrintResult | null> => {
      setPrinting(true);
      setError(null);
      try {
        const shop = settingsService.toShopInfo(settings);
        const result = await printerService.print(target, shop, strategy);
        if (result.usedFallback) {
          logger.info('Printed via PDF fallback', { invoiceNo: target.invoiceNo });
        }
        return result;
      } catch (err) {
        setError(toAppError(err).userMessage);
        return null;
      } finally {
        setPrinting(false);
      }
    },
    [settings],
  );

  return {
    cart,
    totals: cart.totals(),
    currency: settings.currency,
    submitting,
    printing,
    error,
    invoice,
    checkout,
    print,
    clearError: () => setError(null),
  };
}
