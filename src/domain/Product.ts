/**
 * A sellable item. Refuses to exist in an invalid state: the constructor is
 * the last line of defence before bad data reaches the database, even if a
 * screen forgot to validate (guide §9.2, defence in depth).
 */

import { ValidationError } from '../errors/AppError';
import { Money, assertNonNegative } from './Money';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../config/constants';

export interface ProductProps {
  id?: number;
  barcode: string;
  name: string;
  category?: string | null;
  /** What the shop paid. Used for margin reporting. */
  purchasePrice: Money;
  /** What the customer pays. */
  sellingPrice: Money;
  /** Fraction, not percent: 0.15 means 15%. */
  taxRate?: number;
  stockQty: number;
  imageUri?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export class Product {
  readonly id?: number;
  readonly barcode: string;
  readonly name: string;
  readonly category: string | null;
  readonly purchasePrice: Money;
  readonly sellingPrice: Money;
  readonly taxRate: number;
  readonly stockQty: number;
  readonly imageUri: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(props: ProductProps) {
    const fields: Record<string, string> = {};

    const barcode = props.barcode?.trim() ?? '';
    if (barcode === '') fields.barcode = 'Barcode is required.';
    if (barcode.length > 64) fields.barcode = 'Barcode is too long.';

    const name = props.name?.trim() ?? '';
    if (name === '') fields.name = 'Product name is required.';
    if (name.length > 120) fields.name = 'Product name is too long.';

    try {
      assertNonNegative(props.sellingPrice, 'Selling price');
    } catch {
      fields.sellingPrice = 'Selling price must be zero or more.';
    }

    try {
      assertNonNegative(props.purchasePrice, 'Purchase price');
    } catch {
      fields.purchasePrice = 'Purchase price must be zero or more.';
    }

    const taxRate = props.taxRate ?? 0;
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
      fields.taxRate = 'Tax rate must be between 0 and 1 (0.15 = 15%).';
    }

    if (!Number.isInteger(props.stockQty) || props.stockQty < 0) {
      fields.stockQty = 'Stock must be a whole number, zero or more.';
    }

    if (Object.keys(fields).length > 0) {
      throw new ValidationError(
        `Invalid product: ${Object.values(fields).join(' ')}`,
        { fields, userMessage: Object.values(fields)[0] },
      );
    }

    const now = new Date().toISOString();
    this.id = props.id;
    this.barcode = barcode;
    this.name = name;
    this.category = props.category?.trim() || null;
    this.purchasePrice = props.purchasePrice;
    this.sellingPrice = props.sellingPrice;
    this.taxRate = taxRate;
    this.stockQty = props.stockQty;
    this.imageUri = props.imageUri || null;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? now;
    this.updatedAt = props.updatedAt ?? now;

    Object.freeze(this);
  }

  isInStock(): boolean {
    return this.stockQty > 0;
  }

  isLowStock(threshold: number = DEFAULT_LOW_STOCK_THRESHOLD): boolean {
    return this.stockQty <= threshold;
  }

  isOutOfStock(): boolean {
    return this.stockQty <= 0;
  }

  /** Profit per unit. Negative means the product is sold at a loss. */
  marginPerUnit(): Money {
    return this.sellingPrice - this.purchasePrice;
  }

  /** Returns a new Product; instances are immutable. */
  with(changes: Partial<ProductProps>): Product {
    return new Product({
      id: this.id,
      barcode: this.barcode,
      name: this.name,
      category: this.category,
      purchasePrice: this.purchasePrice,
      sellingPrice: this.sellingPrice,
      taxRate: this.taxRate,
      stockQty: this.stockQty,
      imageUri: this.imageUri,
      isActive: this.isActive,
      createdAt: this.createdAt,
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  }

  /** Stock after selling `quantity`. Throws if it would go negative. */
  withStockReducedBy(quantity: number): Product {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new ValidationError(`Quantity must be a whole number, got ${quantity}`);
    }
    if (quantity > this.stockQty) {
      throw new ValidationError(
        `Cannot sell ${quantity} of "${this.name}" — only ${this.stockQty} in stock`,
        { userMessage: `Only ${this.stockQty} of ${this.name} left in stock.` },
      );
    }
    return this.with({ stockQty: this.stockQty - quantity });
  }
}
