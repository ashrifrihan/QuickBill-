/**
 * A product plus a quantity, as it sits in the cart.
 *
 * Note it copies `name`, `unitPrice` and `taxRate` off the Product rather than
 * holding a live reference. That is the same rule the `invoice_items` table
 * follows (guide §6): the price charged is fixed at the moment of sale, so a
 * later price change can never rewrite history.
 */

import { ValidationError } from '../errors/AppError';
import { Money, multiply, assertNonNegative } from './Money';
import { Product } from './Product';

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 9999;

export interface CartItemProps {
  productId?: number;
  barcode: string;
  name: string;
  unitPrice: Money;
  taxRate: number;
  quantity: number;
  /** Stock on hand when the item was added, for an over-sell warning. */
  availableStock?: number;
}

export class CartItem {
  readonly productId?: number;
  readonly barcode: string;
  readonly name: string;
  readonly unitPrice: Money;
  readonly taxRate: number;
  readonly quantity: number;
  readonly availableStock: number;

  constructor(props: CartItemProps) {
    if (!props.name?.trim()) {
      throw new ValidationError('Cart item needs a product name');
    }
    assertNonNegative(props.unitPrice, 'Unit price');

    if (!Number.isInteger(props.quantity)) {
      throw new ValidationError(`Quantity must be a whole number, got ${props.quantity}`);
    }
    if (props.quantity < MIN_QUANTITY) {
      throw new ValidationError(`Quantity cannot be below ${MIN_QUANTITY}`, {
        userMessage: 'Remove the item instead of setting quantity to zero.',
      });
    }
    if (props.quantity > MAX_QUANTITY) {
      throw new ValidationError(`Quantity cannot exceed ${MAX_QUANTITY}`, {
        userMessage: `Maximum quantity per line is ${MAX_QUANTITY}.`,
      });
    }

    this.productId = props.productId;
    this.barcode = props.barcode;
    this.name = props.name.trim();
    this.unitPrice = props.unitPrice;
    this.taxRate = props.taxRate ?? 0;
    this.quantity = props.quantity;
    this.availableStock = props.availableStock ?? Number.MAX_SAFE_INTEGER;

    Object.freeze(this);
  }

  static fromProduct(product: Product, quantity = 1): CartItem {
    return new CartItem({
      productId: product.id,
      barcode: product.barcode,
      name: product.name,
      unitPrice: product.sellingPrice,
      taxRate: product.taxRate,
      quantity,
      availableStock: product.stockQty,
    });
  }

  /** unitPrice × quantity, before any cart-level discount. */
  lineTotal(): Money {
    return multiply(this.unitPrice, this.quantity);
  }

  /** True when this line is asking for more units than the shop has. */
  exceedsStock(): boolean {
    return this.quantity > this.availableStock;
  }

  increaseQty(by = 1): CartItem {
    return this.withQuantity(this.quantity + by);
  }

  /** Decreasing below 1 is clamped — the caller removes the line instead. */
  decreaseQty(by = 1): CartItem {
    return this.withQuantity(Math.max(MIN_QUANTITY, this.quantity - by));
  }

  withQuantity(quantity: number): CartItem {
    return new CartItem({ ...this.toProps(), quantity });
  }

  withUnitPrice(unitPrice: Money): CartItem {
    return new CartItem({ ...this.toProps(), unitPrice });
  }

  toProps(): CartItemProps {
    return {
      productId: this.productId,
      barcode: this.barcode,
      name: this.name,
      unitPrice: this.unitPrice,
      taxRate: this.taxRate,
      quantity: this.quantity,
      availableStock: this.availableStock,
    };
  }
}
