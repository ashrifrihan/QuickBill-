/**
 * Guards guide §16, "Bill total ≠ printed total".
 *
 * The receipt must render the *stored invoice* figures and nothing it computed
 * itself, so what the customer is handed always matches what was saved.
 */

import { buildReceiptHtml, buildReceiptText } from '../receiptTemplate';
import { Cart } from '../../domain/Cart';
import { InvoiceFactory } from '../../domain/InvoiceFactory';
import { Product } from '../../domain/Product';
import { formatMoney, fromMajorUnits } from '../../domain/Money';

const shop = { name: 'Test Shop', currency: 'LKR' };

function makeInvoice(overrides: { discountPercent?: number; taxRate?: number } = {}) {
  const product = new Product({
    id: 1,
    barcode: '1000000000001',
    name: 'Tea 100g',
    purchasePrice: fromMajorUnits(80),
    sellingPrice: fromMajorUnits(19.99),
    taxRate: overrides.taxRate ?? 0.15,
    stockQty: 50,
  });

  let cart = Cart.empty().addProduct(product, 3);
  if (overrides.discountPercent) {
    cart = cart.applyDiscount({ type: 'percent', value: overrides.discountPercent });
  }
  return { invoice: InvoiceFactory.fromCart(cart, { invoiceNo: 'INV-20260727-0001' }), cart };
}

describe('receipt rendering', () => {
  it('prints exactly the invoice grand total', () => {
    const { invoice, cart } = makeInvoice({ discountPercent: 10 });
    const expected = formatMoney(invoice.grandTotal, 'LKR');

    // The stored invoice and the live cart must agree in the first place.
    expect(invoice.grandTotal).toBe(cart.grandTotal());

    expect(buildReceiptHtml(invoice, shop)).toContain(expected);
    expect(buildReceiptText(invoice, shop)).toContain(expected);
  });

  it('shows discount and tax lines only when they apply', () => {
    const plain = makeInvoice({ discountPercent: 0, taxRate: 0 }).invoice;
    const text = buildReceiptText(plain, shop);
    expect(text).not.toContain('Discount');
    expect(text).not.toContain('Tax');

    const discounted = makeInvoice({ discountPercent: 10 }).invoice;
    const discountedText = buildReceiptText(discounted, shop);
    expect(discountedText).toContain('Discount');
    expect(discountedText).toContain('Tax');
  });

  it('escapes HTML so a product name cannot break the PDF', () => {
    const product = new Product({
      id: 1,
      barcode: '1',
      name: '<script>alert(1)</script>',
      purchasePrice: 0,
      sellingPrice: 100,
      stockQty: 5,
    });
    const invoice = InvoiceFactory.fromCart(Cart.empty().addProduct(product), {
      invoiceNo: 'INV-1',
    });

    const html = buildReceiptHtml(invoice, shop);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps thermal receipt lines within the paper width', () => {
    const { invoice } = makeInvoice({ discountPercent: 10 });
    const width = 32;
    const lines = buildReceiptText(invoice, shop, width).split('\n');

    // Long product names are truncated, and the label/amount rows are padded
    // to exactly the paper width — never wrapped by the printer.
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(width);
    }
  });

  it('renders every line item', () => {
    const { invoice } = makeInvoice();
    const text = buildReceiptText(invoice, shop);
    for (const item of invoice.items) {
      expect(text).toContain(item.productName);
    }
  });
});
