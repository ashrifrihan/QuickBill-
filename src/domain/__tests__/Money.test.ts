import {
  add,
  applyRate,
  distribute,
  formatMoney,
  fromMajorUnits,
  multiply,
  parseMoney,
  percentOf,
  toMajorUnits,
} from '../Money';
import { ValidationError } from '../../errors/AppError';

describe('Money', () => {
  describe('the float problem this module exists to solve', () => {
    it('does not lose a cent where floating point would', () => {
      // 0.1 + 0.2 !== 0.3 in float. In minor units it is exact.
      expect(add(fromMajorUnits(0.1), fromMajorUnits(0.2))).toBe(30);
      expect(toMajorUnits(add(fromMajorUnits(0.1), fromMajorUnits(0.2)))).toBe(0.3);
    });

    it('stays exact over a long cart of awkward prices', () => {
      const prices = Array.from({ length: 100 }, () => fromMajorUnits(0.07));
      expect(add(...prices)).toBe(700);
    });
  });

  describe('parseMoney', () => {
    it.each([
      ['12.50', 1250],
      ['12.5', 1250],
      ['12', 1200],
      ['0.01', 1],
      ['1,299.99', 129999],
      ['  42.00  ', 4200],
      ['.5', 50],
    ])('parses %s to %d minor units', (input, expected) => {
      expect(parseMoney(input)).toBe(expected);
    });

    it.each(['', 'abc', '1.2.3', '12a', '$5'])('rejects %s', (input) => {
      expect(parseMoney(input)).toBeNull();
    });

    it('rounds sub-cent input rather than truncating', () => {
      expect(parseMoney('0.005')).toBe(1);
      expect(parseMoney('0.004')).toBe(0);
    });
  });

  describe('multiply', () => {
    it('is exact for whole quantities', () => {
      expect(multiply(333, 3)).toBe(999);
    });

    it('refuses fractional quantities', () => {
      expect(() => multiply(100, 1.5)).toThrow(ValidationError);
    });
  });

  describe('applyRate / percentOf', () => {
    it('rounds half up, the way a shopkeeper checking by hand would', () => {
      // 105 * 0.15 = 15.75 → 16
      expect(applyRate(105, 0.15)).toBe(16);
      // 10 * 0.15 = 1.5 → 2
      expect(applyRate(10, 0.15)).toBe(2);
    });

    it('computes percentages', () => {
      expect(percentOf(10000, 10)).toBe(1000);
      expect(percentOf(999, 50)).toBe(500); // 499.5 → 500
    });

    it('rejects a negative rate', () => {
      expect(() => applyRate(100, -0.1)).toThrow(ValidationError);
    });
  });

  describe('distribute', () => {
    it('splits so the parts always sum back to the whole', () => {
      // 10 split three ways cannot divide evenly; nothing may be lost.
      const parts = distribute(10, [1, 1, 1]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(10);
    });

    it('weights by line value', () => {
      const parts = distribute(100, [300, 100]);
      expect(parts).toEqual([75, 25]);
      expect(parts[0] + parts[1]).toBe(100);
    });

    it('gives leftover units to the largest remainders', () => {
      const parts = distribute(100, [333, 333, 334]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    });

    it('never invents or loses money across many random splits', () => {
      for (let i = 0; i < 500; i += 1) {
        const total = Math.floor(Math.random() * 100_000);
        const weights = Array.from(
          { length: 1 + Math.floor(Math.random() * 8) },
          () => 1 + Math.floor(Math.random() * 5000),
        );
        const parts = distribute(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts.every((p) => p >= 0)).toBe(true);
      }
    });

    it('handles zero weights without dividing by zero', () => {
      expect(distribute(50, [0, 0])).toEqual([50, 0]);
    });

    it('handles an empty cart', () => {
      expect(distribute(0, [])).toEqual([]);
    });
  });

  describe('formatMoney', () => {
    it('groups thousands and always shows two decimals', () => {
      expect(formatMoney(129999, 'LKR')).toBe('LKR 1,299.99');
      expect(formatMoney(5, 'LKR')).toBe('LKR 0.05');
      expect(formatMoney(100000000, 'LKR')).toBe('LKR 1,000,000.00');
    });

    it('puts the sign in front of the whole amount', () => {
      expect(formatMoney(-1250, 'LKR')).toBe('-LKR 12.50');
    });

    it('omits the separator when there is no currency code', () => {
      expect(formatMoney(-1250, '')).toBe('-12.50');
      expect(formatMoney(1250, '')).toBe('12.50');
    });
  });
});
