/**
 * The cart owns ALL price arithmetic for the app (guide §8.4).
 *
 * Nothing else — not a screen, not the printer, not the PDF template — is
 * allowed to add up money. They all read `totals()`. That is what guarantees
 * the number on screen, the number saved to the invoice, and the number on the
 * printed receipt can never disagree.
 *
 * Order of operations (fixed and documented, per guide §8.4):
 *   1. subtotal   = Σ (unitPrice × qty)
 *   2. discount   applied to the subtotal
 *   3. tax        charged per line, on that line's DISCOUNTED share
 *   4. grandTotal = subtotal − discount + tax
 *
 * Tax is per line because different products carry different rates; the
 * cart-level discount is spread across lines proportionally, using
 * largest-remainder distribution so the parts sum back exactly.
 */

import { ValidationError } from '../errors/AppError';
import { CartItem } from './CartItem';
import { Product } from './Product';
import {
  Money,
  ZERO,
  add,
  applyRate,
  assertNonNegative,
  clampToZero,
  distribute,
  percentOf,
} from './Money';

export type DiscountType = 'none' | 'amount' | 'percent';

export interface Discount {
  type: DiscountType;
  /** Minor units when type is 'amount'; 0–100 when type is 'percent'. */
  value: number;
}

export const NO_DISCOUNT: Discount = { type: 'none', value: 0 };

/** Per-line breakdown, so the receipt can show its working. */
export interface LineTotals {
  item: CartItem;
  lineTotal: Money;
  discountShare: Money;
  taxableAmount: Money;
  tax: Money;
  /** taxableAmount + tax */
  lineGrandTotal: Money;
}

export interface CartTotals {
  subtotal: Money;
  discount: Money;
  taxableTotal: Money;
  tax: Money;
  grandTotal: Money;
  itemCount: number;
  unitCount: number;
  lines: LineTotals[];
}

export class Cart {
  readonly items: readonly CartItem[];
  readonly discount: Discount;
  readonly customerName: string | null;
  private readonly _totals: CartTotals;

  constructor(
    items: readonly CartItem[] = [],
    discount: Discount = NO_DISCOUNT,
    customerName: string | null = null,
  ) {
    if (discount.type === 'percent' && (discount.value < 0 || discount.value > 100)) {
      throw new ValidationError(`Discount percent must be 0–100, got ${discount.value}`, {
        userMessage: 'Discount must be between 0% and 100%.',
      });
    }
    if (discount.type === 'amount') {
      assertNonNegative(discount.value, 'Discount');
    }
    this.items = Object.freeze([...items]);
    this.discount = Object.freeze({ ...discount });
    this.customerName = customerName?.trim() || null;
    this._totals = this.computeTotals();
    Object.freeze(this);
  }

  static empty(): Cart {
    return new Cart();
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Lines are keyed by barcode, so re-scanning bumps quantity. */
  private indexOfBarcode(barcode: string): number {
    return this.items.findIndex((i) => i.barcode === barcode);
  }

  findItem(barcode: string): CartItem | undefined {
    return this.items.find((i) => i.barcode === barcode);
  }

  /**
   * Adds a product. Scanning the same barcode twice increments the existing
   * line rather than creating a duplicate — this is what a cashier expects.
   */
  addProduct(product: Product, quantity = 1): Cart {
    const existingIndex = this.indexOfBarcode(product.barcode);
    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];
      return this.replaceAt(existingIndex, existing.increaseQty(quantity));
    }
    return new Cart(
      [...this.items, CartItem.fromProduct(product, quantity)],
      this.discount,
      this.customerName,
    );
  }

  addItem(item: CartItem): Cart {
    const existingIndex = this.indexOfBarcode(item.barcode);
    if (existingIndex >= 0) {
      const existing = this.items[existingIndex];
      return this.replaceAt(existingIndex, existing.increaseQty(item.quantity));
    }
    return new Cart([...this.items, item], this.discount, this.customerName);
  }

  removeItem(barcode: string): Cart {
    return new Cart(
      this.items.filter((i) => i.barcode !== barcode),
      this.discount,
      this.customerName,
    );
  }

  /** Setting quantity to 0 or less removes the line. */
  setQuantity(barcode: string, quantity: number): Cart {
    const index = this.indexOfBarcode(barcode);
    if (index < 0) return this;
    if (quantity <= 0) return this.removeItem(barcode);
    return this.replaceAt(index, this.items[index].withQuantity(quantity));
  }

  increaseQty(barcode: string, by = 1): Cart {
    const index = this.indexOfBarcode(barcode);
    if (index < 0) return this;
    return this.replaceAt(index, this.items[index].increaseQty(by));
  }

  /** Stepping a quantity of 1 down removes the line. */
  decreaseQty(barcode: string, by = 1): Cart {
    const index = this.indexOfBarcode(barcode);
    if (index < 0) return this;
    const item = this.items[index];
    if (item.quantity - by < 1) return this.removeItem(barcode);
    return this.replaceAt(index, item.decreaseQty(by));
  }

  /** Manual price override for a single line (haggling, damaged goods). */
  setUnitPrice(barcode: string, unitPrice: Money): Cart {
    const index = this.indexOfBarcode(barcode);
    if (index < 0) return this;
    return this.replaceAt(index, this.items[index].withUnitPrice(unitPrice));
  }

  applyDiscount(discount: Discount): Cart {
    return new Cart(this.items, discount, this.customerName);
  }

  clearDiscount(): Cart {
    return new Cart(this.items, NO_DISCOUNT, this.customerName);
  }

  withCustomer(customerName: string | null): Cart {
    return new Cart(this.items, this.discount, customerName);
  }

  clear(): Cart {
    return Cart.empty();
  }

  private replaceAt(index: number, item: CartItem): Cart {
    const next = [...this.items];
    next[index] = item;
    return new Cart(next, this.discount, this.customerName);
  }

  // ---------------------------------------------------------------------
  // Money math. Everything below is the single source of truth.
  // ---------------------------------------------------------------------

  subtotal(): Money {
    return add(...this.items.map((i) => i.lineTotal()));
  }

  /**
   * The discount actually granted, never more than the subtotal — a bill can
   * be free but it can never be negative.
   */
  discountAmount(): Money {
    const subtotal = this.subtotal();
    if (this.discount.type === 'none' || subtotal === ZERO) return ZERO;
    const raw =
      this.discount.type === 'percent'
        ? percentOf(subtotal, this.discount.value)
        : this.discount.value;
    return Math.min(clampToZero(raw), subtotal);
  }

  tax(): Money {
    return this.totals().tax;
  }

  grandTotal(): Money {
    return this.totals().grandTotal;
  }

  unitCount(): number {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  /** Lines that ask for more units than are in stock. */
  overSoldItems(): CartItem[] {
    return this.items.filter((i) => i.exceedsStock());
  }

  totals(): CartTotals {
    return this._totals;
  }

  /**
   * Full breakdown. Computed in one pass so every figure is mutually
   * consistent by construction.
   */
  private computeTotals(): CartTotals {
    const lineTotals = this.items.map((i) => i.lineTotal());
    const subtotal = add(...lineTotals);
    const discount = this.discountAmount();

    // Spread the cart discount across lines by value, exactly.
    const discountShares = distribute(discount, lineTotals);

    const lines: LineTotals[] = this.items.map((item, index) => {
      const lineTotal = lineTotals[index];
      const discountShare = discountShares[index] ?? ZERO;
      const taxableAmount = clampToZero(lineTotal - discountShare);
      const tax = applyRate(taxableAmount, item.taxRate);
      return {
        item,
        lineTotal,
        discountShare,
        taxableAmount,
        tax,
        lineGrandTotal: taxableAmount + tax,
      };
    });

    const taxableTotal = add(...lines.map((l) => l.taxableAmount));
    const tax = add(...lines.map((l) => l.tax));

    return {
      subtotal,
      discount,
      taxableTotal,
      tax,
      grandTotal: taxableTotal + tax,
      itemCount: this.items.length,
      unitCount: this.unitCount(),
      lines,
    };
  }

  /** For auto-saving an in-progress cart (guide §9.8). */
  toJSON(): { items: ReturnType<CartItem['toProps']>[]; discount: Discount; customerName: string | null } {
    return {
      items: this.items.map((i) => i.toProps()),
      discount: this.discount,
      customerName: this.customerName,
    };
  }

  static fromJSON(raw: ReturnType<Cart['toJSON']>): Cart {
    return new Cart(
      raw.items.map((p) => new CartItem(p)),
      raw.discount ?? NO_DISCOUNT,
      raw.customerName ?? null,
    );
  }
}
