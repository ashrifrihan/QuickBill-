/**
 * The import path is the dangerous one: it can wipe a shop's history. These
 * tests cover every way a file can be wrong, because each of those is a
 * rejection that must happen BEFORE the database is touched.
 */

import { parseBackup, BACKUP_FORMAT, BACKUP_VERSION } from '../backupFormat';
import { checksumOf } from '../../utils/checksum';
import { ValidationError } from '../../errors/AppError';

function makeData(overrides: Partial<Record<string, unknown[]>> = {}) {
  return {
    products: [
      {
        id: 1,
        barcode: '1000000000001',
        name: 'Tea 100g',
        category: 'Drink',
        purchase_price: 8000,
        selling_price: 10000,
        tax_rate: 0,
        stock_qty: 12,
        image_uri: null,
        is_active: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-01T00:00:00.000Z',
      },
    ],
    invoices: [
      {
        id: 1,
        invoice_no: 'INV-20260727-0001',
        customer_name: null,
        subtotal: 20000,
        discount: 0,
        tax: 0,
        grand_total: 20000,
        amount_paid: 20000,
        payment_status: 'paid',
        payment_method: 'cash',
        cashier_id: 1,
        cashier_name: 'Nimal',
        note: null,
        created_at: '2026-07-27T10:00:00.000Z',
      },
    ],
    invoiceItems: [
      {
        id: 1,
        invoice_id: 1,
        product_id: 1,
        product_name: 'Tea 100g',
        barcode: '1000000000001',
        quantity: 2,
        unit_price: 10000,
        discount_share: 0,
        tax_rate: 0,
        tax: 0,
        line_total: 20000,
      },
    ],
    users: [
      {
        id: 1,
        username: 'admin',
        name: 'Nimal',
        role: 'admin',
        password_hash: 'abc',
        password_salt: 'def',
        is_active: 1,
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ],
    settings: [{ key: 'invoice_sequence', value: '1' }],
    ...overrides,
  };
}

/** Builds a well-formed backup, with a correctly computed checksum. */
function makeBackup(dataOverrides: Partial<Record<string, unknown[]>> = {}) {
  const data = makeData(dataOverrides);
  const canonical = JSON.stringify([
    data.products,
    data.invoices,
    data.invoiceItems,
    data.users,
    data.settings,
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: '2026-07-27T12:00:00.000Z',
    app: { name: 'QuickBill', version: '1.0.0' },
    shop: 'Test Shop',
    counts: {
      products: data.products.length,
      invoices: data.invoices.length,
      invoiceItems: data.invoiceItems.length,
      users: data.users.length,
      settings: data.settings.length,
    },
    checksum: checksumOf(canonical),
    data,
  };
}

describe('parseBackup', () => {
  it('accepts a well-formed backup', () => {
    const backup = parseBackup(JSON.stringify(makeBackup()));
    expect(backup.data.products).toHaveLength(1);
    expect(backup.data.invoices[0].invoice_no).toBe('INV-20260727-0001');
  });

  it('survives a JSON round trip (what actually happens on export/import)', () => {
    const written = JSON.stringify(makeBackup(), null, 2);
    expect(() => parseBackup(written)).not.toThrow();
  });

  describe('rejections', () => {
    it('rejects text that is not JSON', () => {
      expect(() => parseBackup('not json at all')).toThrow(ValidationError);
    });

    it('rejects an empty file', () => {
      expect(() => parseBackup('')).toThrow(ValidationError);
    });

    it('rejects unrelated JSON with a helpful message', () => {
      try {
        parseBackup(JSON.stringify({ hello: 'world' }));
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).userMessage).toMatch(/not a QuickBill backup/i);
      }
    });

    it('rejects a backup from a NEWER app version', () => {
      const backup = { ...makeBackup(), version: BACKUP_VERSION + 1 };
      try {
        parseBackup(JSON.stringify(backup));
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as ValidationError).userMessage).toMatch(/newer version/i);
      }
    });

    it('rejects a corrupted file whose checksum no longer matches', () => {
      const backup = makeBackup();
      // Tamper with a price, exactly what silent corruption looks like.
      backup.data.products[0].selling_price = 999999;
      try {
        parseBackup(JSON.stringify(backup));
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as ValidationError).userMessage).toMatch(/corrupted/i);
      }
    });

    it('rejects a truncated file whose counts disagree with its contents', () => {
      const backup = makeBackup();
      backup.counts.products = 5; // header claims more than the file holds
      try {
        parseBackup(JSON.stringify(backup));
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as ValidationError).userMessage).toMatch(/incomplete/i);
      }
    });

    it('rejects a missing required field', () => {
      const backup = makeBackup();
      delete (backup.data.products[0] as Record<string, unknown>).barcode;
      expect(() => parseBackup(JSON.stringify(backup))).toThrow(ValidationError);
    });

    it('rejects a money field that is not a whole number of cents', () => {
      const backup = makeBackup();
      // A float here would reintroduce exactly the rounding bug Money.ts exists
      // to prevent, so it must never get into the database.
      backup.data.products[0].selling_price = 100.55;
      expect(() => parseBackup(JSON.stringify(backup))).toThrow(ValidationError);
    });

    it('names the field that failed, so the user can act on it', () => {
      const backup = makeBackup();
      (backup.data.invoices[0] as Record<string, unknown>).grand_total = 'lots';
      try {
        parseBackup(JSON.stringify(backup));
        throw new Error('should have thrown');
      } catch (error) {
        expect((error as ValidationError).userMessage).toMatch(/grand_total/);
      }
    });

    it('rejects null where an array is required', () => {
      const backup = makeBackup();
      (backup.data as Record<string, unknown>).invoices = null;
      expect(() => parseBackup(JSON.stringify(backup))).toThrow(ValidationError);
    });
  });

  describe('empty shop', () => {
    it('accepts a backup of a brand new shop with no data', () => {
      const backup = makeBackup({
        products: [],
        invoices: [],
        invoiceItems: [],
        users: [],
        settings: [],
      });
      const parsed = parseBackup(JSON.stringify(backup));
      expect(parsed.data.products).toHaveLength(0);
    });
  });
});

describe('checksumOf', () => {
  it('is stable for the same input', () => {
    expect(checksumOf('hello world')).toBe(checksumOf('hello world'));
  });

  it('changes when a single character changes', () => {
    expect(checksumOf('hello world')).not.toBe(checksumOf('hello worle'));
  });

  it('detects transposed characters', () => {
    // A weak hash returns the same value for these, which would let a
    // corrupted backup import cleanly.
    expect(checksumOf('ab')).not.toBe(checksumOf('ba'));
    expect(checksumOf('1234')).not.toBe(checksumOf('1243'));
  });

  it('detects truncation', () => {
    const full = JSON.stringify({ a: 1, b: 2, c: 3 });
    expect(checksumOf(full)).not.toBe(checksumOf(full.slice(0, -5)));
  });

  it('detects appended data', () => {
    expect(checksumOf('data')).not.toBe(checksumOf('data '));
  });

  it('handles an empty string', () => {
    expect(typeof checksumOf('')).toBe('string');
    expect(checksumOf('')).toHaveLength(16);
  });

  it('always produces 16 hex characters', () => {
    for (const sample of ['', 'a', 'a longer string', JSON.stringify(makeData())]) {
      expect(checksumOf(sample)).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('does not collide across many similar inputs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i += 1) seen.add(checksumOf(`invoice-${i}`));
    expect(seen.size).toBe(5000);
  });
});
