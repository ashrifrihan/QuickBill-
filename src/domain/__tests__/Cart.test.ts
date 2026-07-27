import { Cart, NO_DISCOUNT } from '../Cart';
import { CartItem } from '../CartItem';
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

describe('Cart', () => {
  describe('building the cart', () => {
    it('starts empty', () => {
      const cart = Cart.empty();
      expect(cart.isEmpty).toBe(true);
      expect(cart.grandTotal()).toBe(0);
      expect(cart.totals().lines).toEqual([]);
    });

    it('bumps quantity instead of duplicating when the same barcode is scanned twice', () => {
      const product = makeProduct();
      const cart = Cart.empty().addProduct(product).addProduct(product);

      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);
      expect(cart.grandTotal()).toBe(fromMajorUnits(200));
    });

    it('keeps separate lines for different products', () => {
      const cart = Cart.empty()
        .addProduct(makeProduct())
        .addProduct(makeProduct({ id: 2, barcode: '2', name: 'Sugar 1kg' }));

      expect(cart.items).toHaveLength(2);
    });

    it('removes a line when its quantity is stepped below one', () => {
      const product = makeProduct();
      const cart = Cart.empty().addProduct(product).decreaseQty(product.barcode);
      expect(cart.isEmpty).toBe(true);
    });

    it('treats setQuantity(0) as a removal', () => {
      const product = makeProduct();
      const cart = Cart.empty().addProduct(product).setQuantity(product.barcode, 0);
      expect(cart.isEmpty).toBe(true);
    });

    it('is immutable — every operation returns a new cart', () => {
      const product = makeProduct();
      const first = Cart.empty();
      const second = first.addProduct(product);

      expect(first.isEmpty).toBe(true);
      expect(second.isEmpty).toBe(false);
      expect(first).not.toBe(second);
    });
  });

  describe('totals', () => {
    it('multiplies unit price by quantity', () => {
      const cart = Cart.empty().addProduct(makeProduct({ sellingPrice: fromMajorUnits(12.5) }), 4);
      expect(cart.subtotal()).toBe(fromMajorUnits(50));
    });

    it('applies discount before tax, on the discounted subtotal', () => {
      // 1000.00 subtotal, 10% off = 900.00 taxable, 15% tax = 135.00
      const cart = Cart.empty()
        .addProduct(makeProduct({ sellingPrice: fromMajorUnits(1000), taxRate: 0.15 }))
        .applyDiscount({ type: 'percent', value: 10 });

      const totals = cart.totals();
      expect(totals.subtotal).toBe(fromMajorUnits(1000));
      expect(totals.discount).toBe(fromMajorUnits(100));
      expect(totals.taxableTotal).toBe(fromMajorUnits(900));
      expect(totals.tax).toBe(fromMajorUnits(135));
      expect(totals.grandTotal).toBe(fromMajorUnits(1035));
    });

    it('charges each line its own tax rate', () => {
      const cart = Cart.empty()
        .addProduct(makeProduct({ sellingPrice: fromMajorUnits(100), taxRate: 0 }))
        .addProduct(
          makeProduct({ id: 2, barcode: '2', sellingPrice: fromMajorUnits(100), taxRate: 0.15 }),
        );

      expect(cart.totals().tax).toBe(fromMajorUnits(15));
      expect(cart.grandTotal()).toBe(fromMajorUnits(215));
    });

    it('spreads a cart discount across lines so the parts sum to the whole', () => {
      const cart = Cart.empty()
        .addProduct(makeProduct({ sellingPrice: fromMajorUnits(3.33) }))
        .addProduct(makeProduct({ id: 2, barcode: '2', sellingPrice: fromMajorUnits(3.33) }))
        .addProduct(makeProduct({ id: 3, barcode: '3', sellingPrice: fromMajorUnits(3.34) }))
        .applyDiscount({ type: 'amount', value: 100 }); // 1.00 off

      const totals = cart.totals();
      const shares = totals.lines.reduce((sum, l) => sum + l.discountShare, 0);
      expect(shares).toBe(totals.discount);
      expect(totals.discount).toBe(100);
    });

    it('keeps the header figures equal to the sum of the lines', () => {
      const cart = Cart.empty()
        .addProduct(makeProduct({ sellingPrice: fromMajorUnits(19.99), taxRate: 0.15 }), 3)
        .addProduct(
          makeProduct({ id: 2, barcode: '2', sellingPrice: fromMajorUnits(7.77), taxRate: 0.08 }),
          2,
        )
        .applyDiscount({ type: 'percent', value: 12.5 });

      const totals = cart.totals();
      const lineSum = totals.lines.reduce((s, l) => s + l.lineGrandTotal, 0);

      expect(lineSum).toBe(totals.grandTotal);
      expect(totals.subtotal - totals.discount + totals.tax).toBe(totals.grandTotal);
    });

    it('never lets a discount push the total below zero', () => {
      const cart = Cart.empty()
        .addProduct(makeProduct({ sellingPrice: fromMajorUnits(10) }))
        .applyDiscount({ type: 'amount', value: fromMajorUnits(999) });

      expect(cart.totals().discount).toBe(fromMajorUnits(10));
      expect(cart.grandTotal()).toBe(0);
    });

    it('handles a 100% discount', () => {
      const cart = Cart.empty()
        .addProduct(makeProduct({ sellingPrice: fromMajorUnits(10), taxRate: 0.15 }))
        .applyDiscount({ type: 'percent', value: 100 });

      expect(cart.grandTotal()).toBe(0);
      expect(cart.totals().tax).toBe(0);
    });

    it('counts units and lines separately', () => {
      const cart = Cart.empty()
        .addProduct(makeProduct(), 3)
        .addProduct(makeProduct({ id: 2, barcode: '2' }), 2);

      expect(cart.totals().itemCount).toBe(2);
      expect(cart.totals().unitCount).toBe(5);
    });
  });

  describe('discount validation', () => {
    it('rejects a percentage above 100', () => {
      expect(() => Cart.empty().applyDiscount({ type: 'percent', value: 101 })).toThrow(
        ValidationError,
      );
    });

    it('rejects a negative discount amount', () => {
      expect(() => Cart.empty().applyDiscount({ type: 'amount', value: -5 })).toThrow(
        ValidationError,
      );
    });

    it('ignores a discount on an empty cart', () => {
      const cart = Cart.empty().applyDiscount({ type: 'percent', value: 50 });
      expect(cart.discountAmount()).toBe(0);
    });
  });

  describe('stock awareness', () => {
    it('flags lines that ask for more than is in stock', () => {
      const cart = Cart.empty().addProduct(makeProduct({ stockQty: 2 }), 5);
      expect(cart.overSoldItems()).toHaveLength(1);
    });

    it('reports nothing oversold when stock is sufficient', () => {
      const cart = Cart.empty().addProduct(makeProduct({ stockQty: 10 }), 5);
      expect(cart.overSoldItems()).toHaveLength(0);
    });
  });

  describe('draft round-trip (crash recovery)', () => {
    it('restores an identical cart from its saved JSON', () => {
      const original = Cart.empty()
        .addProduct(makeProduct({ taxRate: 0.15 }), 3)
        .applyDiscount({ type: 'percent', value: 10 })
        .withCustomer('Nimal');

      const restored = Cart.fromJSON(JSON.parse(JSON.stringify(original.toJSON())));

      expect(restored.grandTotal()).toBe(original.grandTotal());
      expect(restored.items).toHaveLength(original.items.length);
      expect(restored.customerName).toBe('Nimal');
      expect(restored.discount).toEqual(original.discount);
    });
  });
});

describe('CartItem', () => {
  it('computes its own line total', () => {
    const item = CartItem.fromProduct(makeProduct({ sellingPrice: fromMajorUnits(2.5) }), 4);
    expect(item.lineTotal()).toBe(fromMajorUnits(10));
  });

  it('will not go below quantity 1', () => {
    const item = CartItem.fromProduct(makeProduct(), 1);
    expect(item.decreaseQty().quantity).toBe(1);
  });

  it('rejects a fractional quantity', () => {
    expect(() => CartItem.fromProduct(makeProduct(), 1.5)).toThrow(ValidationError);
  });

  it('copies price off the product so a later reprice cannot change it', () => {
    const product = makeProduct({ sellingPrice: fromMajorUnits(100) });
    const item = CartItem.fromProduct(product, 1);
    const repriced = product.with({ sellingPrice: fromMajorUnits(500) });

    expect(repriced.sellingPrice).toBe(fromMajorUnits(500));
    expect(item.unitPrice).toBe(fromMajorUnits(100));
  });
});
