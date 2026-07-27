import { Cart } from '../Cart';
import { InvoiceFactory } from '../InvoiceFactory';
import { Product } from '../Product';
import { fromMajorUnits } from '../Money';
import { ValidationError } from '../../errors/AppError';

function makeProduct(overrides: Partial<ConstructorParameters<typeof Product>[0]> = {}): Product {
  return new Product({
    id: 1,
    barcode: '1000000000001',
    name: 'Tea 100g',
    purchasePrice: fromMajorUnits(80),
    sellingPrice: fromMajorUnits(100),
    taxRate: 0,
    stockQty: 50,
    ...overrides,
  });
}

describe('InvoiceFactory', () => {
  it('refuses to create an invoice from an empty cart', () => {
    expect(() => InvoiceFactory.fromCart(Cart.empty(), { invoiceNo: 'INV-1' })).toThrow(
      ValidationError,
    );
  });

  it('carries the cart totals through unchanged', () => {
    const cart = Cart.empty()
      .addProduct(makeProduct({ sellingPrice: fromMajorUnits(19.99), taxRate: 0.15 }), 3)
      .applyDiscount({ type: 'percent', value: 10 });

    const totals = cart.totals();
    const invoice = InvoiceFactory.fromCart(cart, { invoiceNo: 'INV-1' });

    expect(invoice.subtotal).toBe(totals.subtotal);
    expect(invoice.discount).toBe(totals.discount);
    expect(invoice.tax).toBe(totals.tax);
    expect(invoice.grandTotal).toBe(totals.grandTotal);
  });

  it('produces an invoice whose stored figures add up', () => {
    const cart = Cart.empty()
      .addProduct(makeProduct({ sellingPrice: fromMajorUnits(33.33), taxRate: 0.15 }), 7)
      .addProduct(
        makeProduct({ id: 2, barcode: '2', sellingPrice: fromMajorUnits(1.11), taxRate: 0.08 }),
        13,
      )
      .applyDiscount({ type: 'amount', value: fromMajorUnits(17.77) });

    const invoice = InvoiceFactory.fromCart(cart, { invoiceNo: 'INV-1' });
    expect(invoice.isBalanced()).toBe(true);
  });

  it('copies the product name and price onto each line', () => {
    const cart = Cart.empty().addProduct(makeProduct({ name: 'Tea 100g' }), 2);
    const invoice = InvoiceFactory.fromCart(cart, { invoiceNo: 'INV-1' });

    expect(invoice.items[0].productName).toBe('Tea 100g');
    expect(invoice.items[0].unitPrice).toBe(fromMajorUnits(100));
    expect(invoice.items[0].quantity).toBe(2);
  });

  it('is frozen once created', () => {
    const cart = Cart.empty().addProduct(makeProduct());
    const invoice = InvoiceFactory.fromCart(cart, { invoiceNo: 'INV-1' });

    expect(Object.isFrozen(invoice)).toBe(true);
    expect(() => {
      (invoice as unknown as { grandTotal: number }).grandTotal = 0;
    }).toThrow();
  });

  it('records change due when more cash is handed over than owed', () => {
    const cart = Cart.empty().addProduct(makeProduct({ sellingPrice: fromMajorUnits(90) }));
    const invoice = InvoiceFactory.fromCart(cart, {
      invoiceNo: 'INV-1',
      amountPaid: fromMajorUnits(100),
    });

    expect(invoice.changeDue()).toBe(fromMajorUnits(10));
    expect(invoice.balanceDue()).toBe(0);
  });

  it('records a balance due on a partly paid bill', () => {
    const cart = Cart.empty().addProduct(makeProduct({ sellingPrice: fromMajorUnits(90) }));
    const invoice = InvoiceFactory.fromCart(cart, {
      invoiceNo: 'INV-1',
      paymentStatus: 'partial',
      amountPaid: fromMajorUnits(50),
    });

    expect(invoice.balanceDue()).toBe(fromMajorUnits(40));
    expect(invoice.changeDue()).toBe(0);
  });

  describe('formatInvoiceNo', () => {
    it('zero-pads the sequence and stamps the date', () => {
      const date = new Date(2026, 6, 27); // 27 July 2026, local time
      expect(InvoiceFactory.formatInvoiceNo('INV', 7, date)).toBe('INV-20260727-0007');
    });

    it('keeps sequences sortable past 4 digits', () => {
      const date = new Date(2026, 6, 27);
      expect(InvoiceFactory.formatInvoiceNo('INV', 12345, date)).toBe('INV-20260727-12345');
    });

    it('gives consecutive sequences distinct numbers', () => {
      const date = new Date(2026, 6, 27);
      const a = InvoiceFactory.formatInvoiceNo('INV', 1, date);
      const b = InvoiceFactory.formatInvoiceNo('INV', 2, date);
      expect(a).not.toBe(b);
    });
  });
});

describe('Product', () => {
  it('rejects a negative selling price', () => {
    expect(() => makeProduct({ sellingPrice: -1 })).toThrow(ValidationError);
  });

  it('rejects a blank name', () => {
    expect(() => makeProduct({ name: '   ' })).toThrow(ValidationError);
  });

  it('rejects a blank barcode', () => {
    expect(() => makeProduct({ barcode: '' })).toThrow(ValidationError);
  });

  it('rejects fractional stock', () => {
    expect(() => makeProduct({ stockQty: 1.5 })).toThrow(ValidationError);
  });

  it('reports field-level messages a form can display', () => {
    try {
      makeProduct({ sellingPrice: -1, name: '' });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).fields).toMatchObject({
        name: expect.any(String),
        sellingPrice: expect.any(String),
      });
    }
  });

  it('flags low stock at or below the threshold', () => {
    expect(makeProduct({ stockQty: 5 }).isLowStock(5)).toBe(true);
    expect(makeProduct({ stockQty: 6 }).isLowStock(5)).toBe(false);
  });

  it('refuses to reduce stock below zero', () => {
    expect(() => makeProduct({ stockQty: 2 }).withStockReducedBy(3)).toThrow(ValidationError);
  });

  it('reduces stock when there is enough', () => {
    expect(makeProduct({ stockQty: 10 }).withStockReducedBy(3).stockQty).toBe(7);
  });
});
