/**
 * Money is stored and calculated as an INTEGER number of minor units
 * (cents / Sri Lankan rupee cents). Never as a float.
 *
 * `0.1 + 0.2 !== 0.3` in floating point; on a till that becomes a real
 * cash discrepancy. Every amount that crosses a layer boundary — model,
 * database, printed receipt — is an integer of this type.
 */

import { ValidationError } from '../errors/AppError';

/** An integer count of minor units. 1250 === 12.50 */
export type Money = number;

export const ZERO: Money = 0;

const MINOR_UNITS_PER_MAJOR = 100;

export function isMoney(value: unknown): value is Money {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Throws unless `value` is a usable integer minor-unit amount. */
export function assertMoney(value: number, label = 'amount'): Money {
  if (!Number.isFinite(value)) {
    throw new ValidationError(`${label} must be a finite number, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError(`${label} must be a whole number of cents, got ${value}`);
  }
  return value;
}

export function assertNonNegative(value: number, label = 'amount'): Money {
  assertMoney(value, label);
  if (value < 0) {
    throw new ValidationError(`${label} cannot be negative`, {
      userMessage: `${label} cannot be negative.`,
    });
  }
  return value;
}

/**
 * Parses user input ("12.5", "1,299.99") into minor units.
 * Returns null for anything unparseable so callers can show a field error.
 */
export function parseMoney(input: string | number): Money | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * MINOR_UNITS_PER_MAJOR);
  }
  const cleaned = input.trim().replace(/,/g, '');
  if (cleaned === '') return null;
  if (!/^-?\d*(\.\d*)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  // Round rather than truncate so "0.005" behaves predictably.
  return Math.round(parsed * MINOR_UNITS_PER_MAJOR);
}

/** Like parseMoney but throws a ValidationError instead of returning null. */
export function requireMoney(input: string | number, label = 'amount'): Money {
  const parsed = parseMoney(input);
  if (parsed === null) {
    throw new ValidationError(`Could not parse ${label} from "${input}"`, {
      userMessage: `Enter a valid ${label}.`,
    });
  }
  return parsed;
}

/** Minor units → major units as a float. For display/export only, never math. */
export function toMajorUnits(amount: Money): number {
  return amount / MINOR_UNITS_PER_MAJOR;
}

export function fromMajorUnits(amount: number): Money {
  return Math.round(amount * MINOR_UNITS_PER_MAJOR);
}

export function add(...amounts: Money[]): Money {
  return amounts.reduce((sum, a) => sum + a, 0);
}

export function subtract(a: Money, b: Money): Money {
  return a - b;
}

/** Multiplies by a whole quantity. Exact — no rounding needed. */
export function multiply(amount: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new ValidationError(`Quantity must be a whole number, got ${quantity}`);
  }
  return amount * quantity;
}

/**
 * Applies a rate (e.g. 0.15 for 15% tax) and rounds half-up to the nearest
 * minor unit. Half-up is what shopkeepers expect; banker's rounding surprises
 * people when they check the arithmetic by hand.
 */
export function applyRate(amount: Money, rate: number): Money {
  if (!Number.isFinite(rate) || rate < 0) {
    throw new ValidationError(`Rate must be a non-negative number, got ${rate}`);
  }
  return roundHalfUp(amount * rate);
}

/** Percentage of an amount, where `percent` is 0–100. */
export function percentOf(amount: Money, percent: number): Money {
  return applyRate(amount, percent / 100);
}

export function roundHalfUp(value: number): Money {
  return Math.sign(value) * Math.round(Math.abs(value));
}

export function max(a: Money, b: Money): Money {
  return a > b ? a : b;
}

export function clampToZero(amount: Money): Money {
  return amount < 0 ? 0 : amount;
}

/**
 * Splits `total` across `weights` so the parts sum EXACTLY back to `total`.
 *
 * Used to spread a cart-level discount over line items. Naive per-line
 * rounding loses or invents a cent; the largest-remainder method hands the
 * leftover units to the lines with the biggest fractional parts.
 */
export function distribute(total: Money, weights: number[]): Money[] {
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weights.length === 0) return [];
  if (weightSum <= 0) {
    // Nothing to weight by — put it all on the first line.
    return weights.map((_, i) => (i === 0 ? total : 0));
  }

  const exact = weights.map((w) => (total * w) / weightSum);
  const floored = exact.map((v) => Math.floor(v));
  let remainder = total - floored.reduce((s, v) => s + v, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floored];
  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    result[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return result;
}

/** Formats for display: `LKR 1,299.50`. */
export function formatMoney(amount: Money, currency = 'LKR'): string {
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const major = Math.floor(absolute / MINOR_UNITS_PER_MAJOR);
  const minor = absolute % MINOR_UNITS_PER_MAJOR;
  const grouped = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = negative ? '-' : '';
  return `${sign}${currency} ${grouped}.${minor.toString().padStart(2, '0')}`;
}

/** Formats without the currency code, for tight table columns. */
export function formatAmount(amount: Money): string {
  return formatMoney(amount, '').trim();
}
