/**
 * Local password hashing (guide §8.1 — "never plain text").
 *
 * Salted, key-stretched SHA-256 via expo-crypto: a per-user random salt plus
 * N iterations, which defeats rainbow tables and makes brute-forcing a stolen
 * database file slow.
 *
 * Honest limitation: this is not bcrypt/argon2. Those need a native module,
 * and expo-crypto only exposes plain digests. For an on-device shop till whose
 * database never leaves the device, salted + stretched SHA-256 is a reasonable
 * trade-off. If accounts ever sync to a server, move authentication to
 * Supabase Auth (already possible behind AuthService's interface) rather than
 * shipping this hash over the wire.
 */

import * as Crypto from 'expo-crypto';
import { PASSWORD_HASH_ITERATIONS } from '../config/constants';

const SALT_BYTES = 16;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_BYTES);
  return toHex(bytes);
}

/**
 * Iterated SHA-256. Each round folds in the salt so the chain cannot be
 * precomputed independently of it.
 */
export async function hashPassword(
  password: string,
  salt: string,
  iterations: number = PASSWORD_HASH_ITERATIONS,
): Promise<string> {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < iterations; i += 1) {
    digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:${digest}:${i}`,
    );
  }
  return digest;
}

/**
 * Length-constant comparison. A plain `===` leaks how many leading characters
 * matched via timing; irrelevant for a local till, but it costs nothing to do
 * right and this code may later guard something that matters.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
  iterations: number = PASSWORD_HASH_ITERATIONS,
): Promise<boolean> {
  const actual = await hashPassword(password, salt, iterations);
  return safeEqual(actual, expectedHash);
}
