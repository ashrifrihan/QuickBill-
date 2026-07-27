import { canonicaliseCategory } from '../format';

describe('canonicaliseCategory', () => {
  const known = ['Drink', 'Snacks', 'Household items'];

  it('reuses the existing spelling on a case-insensitive match', () => {
    // The bug this prevents: "drink" saved alongside "Drink" produced two
    // categories that filtered as separate groups.
    expect(canonicaliseCategory('drink', known)).toBe('Drink');
    expect(canonicaliseCategory('DRINK', known)).toBe('Drink');
    expect(canonicaliseCategory('DrInK', known)).toBe('Drink');
  });

  it('matches regardless of surrounding whitespace', () => {
    expect(canonicaliseCategory('  Drink  ', known)).toBe('Drink');
  });

  it('collapses runs of inner whitespace before matching', () => {
    expect(canonicaliseCategory('Household   items', known)).toBe('Household items');
  });

  it('keeps a genuinely new name, trimmed', () => {
    expect(canonicaliseCategory('  Bakery ', known)).toBe('Bakery');
  });

  it('preserves the casing of a genuinely new name', () => {
    expect(canonicaliseCategory('BAKERY', known)).toBe('BAKERY');
  });

  it('treats blank input as uncategorised', () => {
    expect(canonicaliseCategory('', known)).toBeNull();
    expect(canonicaliseCategory('   ', known)).toBeNull();
    expect(canonicaliseCategory('\t\n', known)).toBeNull();
  });

  it('works against an empty catalogue', () => {
    expect(canonicaliseCategory('Bakery', [])).toBe('Bakery');
    expect(canonicaliseCategory('', [])).toBeNull();
  });

  it('is idempotent — re-canonicalising changes nothing', () => {
    const once = canonicaliseCategory('drink', known);
    expect(canonicaliseCategory(once!, known)).toBe(once);
  });

  it('never creates a second category for any casing of an existing one', () => {
    const variants = ['snacks', 'Snacks', 'SNACKS', ' snacks ', 'SnAcKs'];
    const results = new Set(variants.map((v) => canonicaliseCategory(v, known)));
    expect(results.size).toBe(1);
    expect(results.has('Snacks')).toBe(true);
  });
});
