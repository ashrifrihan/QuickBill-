/**
 * A small, synchronous integrity checksum for backup files.
 *
 * This is an INTEGRITY check, not a security one: it detects truncation,
 * corrupted downloads and accidental edits. It is not a signature and would not
 * stop someone deliberately tampering with a backup — for that the file would
 * need to be signed, which is out of scope for an on-device POS.
 *
 * FNV-1a is used because it is deterministic, dependency-free and synchronous.
 * expo-crypto only offers async digests, which would force the checksum through
 * a Promise in code paths that are otherwise pure and easy to test.
 */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * 64 bits of output, produced as two independently seeded 32-bit FNV-1a passes.
 * A single 32-bit hash collides too readily to trust a shop's whole history to.
 */
export function checksumOf(input: string): string {
  let h1 = FNV_OFFSET_BASIS;
  let h2 = FNV_OFFSET_BASIS ^ 0x9e3779b9;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);

    // Mix the low and high bytes separately so that transposing two characters
    // reliably changes the result.
    h1 ^= code & 0xff;
    h1 = Math.imul(h1, FNV_PRIME);
    h1 ^= code >>> 8;
    h1 = Math.imul(h1, FNV_PRIME);

    h2 ^= code >>> 8;
    h2 = Math.imul(h2, FNV_PRIME);
    h2 ^= code & 0xff;
    h2 = Math.imul(h2, FNV_PRIME);
    // Length-sensitive, so appending or removing trailing data is detected.
    h2 += i;
  }

  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
  return `${hex(h1)}${hex(h2)}`;
}
