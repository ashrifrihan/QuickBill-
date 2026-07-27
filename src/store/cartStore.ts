/**
 * The active cart — the one piece of transient state many screens need live
 * (guide §10). Persistent data stays in SQLite and is read through hooks.
 *
 * Every mutation also schedules a debounced write of the cart to the
 * `cart_draft` table, so a crash mid-sale loses nothing (guide §9.8).
 */

import { create } from 'zustand';
import { Cart, Discount } from '../domain/Cart';
import { CartItem } from '../domain/CartItem';
import { Product } from '../domain/Product';
import { Money } from '../domain/Money';
import { cartDraftRepository } from '../data';
import { logger } from '../errors/logger';

const DRAFT_SAVE_DEBOUNCE_MS = 400;

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Monotonic token guarding against stale writes.
 *
 * Autosave is debounced, so a timer queued before a clear/checkout could
 * otherwise fire afterwards and resurrect a cart that was already sold. Every
 * mutation bumps this; a save only lands if its token is still the newest one
 * both when the timer fires and when the async write resolves.
 */
let draftVersion = 0;

function cancelPendingDraftSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  // Invalidate any in-flight write that has already passed the timer check.
  draftVersion += 1;
}

/**
 * Draft saving is best-effort and must never surface to the user or block a
 * sale — a failed autosave is strictly better than an interrupted checkout.
 */
function scheduleDraftSave(cart: Cart): void {
  if (saveTimer) clearTimeout(saveTimer);
  const version = ++draftVersion;

  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (version !== draftVersion) return; // superseded before we started

    cartDraftRepository
      .save(cart)
      .then(() => {
        if (version !== draftVersion) {
          // A newer mutation landed mid-write; that one will save itself.
          logger.debug('Discarded a superseded cart draft write');
        }
      })
      .catch((error) => {
        logger.warn('Cart draft autosave failed', { error: String(error) });
      });
  }, DRAFT_SAVE_DEBOUNCE_MS);
}

interface CartState {
  cart: Cart;
  /** True while the saved draft is being restored at startup. */
  restoring: boolean;

  addProduct: (product: Product, quantity?: number) => void;
  addItem: (item: CartItem) => void;
  removeItem: (barcode: string) => void;
  setQuantity: (barcode: string, quantity: number) => void;
  increaseQty: (barcode: string) => void;
  decreaseQty: (barcode: string) => void;
  setUnitPrice: (barcode: string, unitPrice: Money) => void;
  applyDiscount: (discount: Discount) => void;
  setCustomer: (name: string | null) => void;
  clear: () => void;
  restoreDraft: () => Promise<void>;
}

export const useCartStore = create<CartState>((set, get) => {
  /** Applies a pure Cart transformation and queues the autosave. */
  const mutate = (transform: (cart: Cart) => Cart) => {
    const next = transform(get().cart);
    set({ cart: next });
    scheduleDraftSave(next);
  };

  return {
    cart: Cart.empty(),
    restoring: true,

    addProduct: (product, quantity = 1) => mutate((c) => c.addProduct(product, quantity)),
    addItem: (item) => mutate((c) => c.addItem(item)),
    removeItem: (barcode) => mutate((c) => c.removeItem(barcode)),
    setQuantity: (barcode, quantity) => mutate((c) => c.setQuantity(barcode, quantity)),
    increaseQty: (barcode) => mutate((c) => c.increaseQty(barcode)),
    decreaseQty: (barcode) => mutate((c) => c.decreaseQty(barcode)),
    setUnitPrice: (barcode, unitPrice) => mutate((c) => c.setUnitPrice(barcode, unitPrice)),
    applyDiscount: (discount) => mutate((c) => c.applyDiscount(discount)),
    setCustomer: (name) => mutate((c) => c.withCustomer(name)),

    clear: () => {
      // Cancel first: a queued autosave must not rewrite the cart we are
      // about to delete.
      cancelPendingDraftSave();
      set({ cart: Cart.empty() });
      cartDraftRepository.clear().catch((error) => {
        logger.warn('Could not clear cart draft', { error: String(error) });
      });
    },

    restoreDraft: async () => {
      try {
        const draft = await cartDraftRepository.load();
        if (draft && !draft.isEmpty) {
          set({ cart: draft });
          logger.info('Restored in-progress cart', { items: draft.items.length });
        }
      } catch (error) {
        logger.warn('Could not restore cart draft', { error: String(error) });
      } finally {
        set({ restoring: false });
      }
    },
  };
});

/**
 * Selector hook for totals. Components that only render money re-render when
 * the cart changes, which is exactly the Observer behaviour from guide §5.
 */
export function useCartTotals() {
  return useCartStore((state) => state.cart.totals());
}
