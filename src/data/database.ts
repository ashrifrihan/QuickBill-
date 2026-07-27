/**
 * The one SQLite connection for the whole app (Singleton, guide §5) plus
 * versioned migrations.
 *
 * Migrations run once at startup and are keyed off SQLite's `user_version`
 * pragma, so adding a step later is just appending to MIGRATIONS.
 */

import * as SQLite from 'expo-sqlite';
import { DB_NAME, DEFAULT_SETTINGS } from '../config/constants';
import { DatabaseError } from '../errors/AppError';
import { logger } from '../errors/logger';

/**
 * The subset of the SQLite API our repositories use. Both `SQLiteDatabase`
 * and a transaction context satisfy it, which is what lets BillingService run
 * repository methods *inside* its checkout transaction.
 */
export interface SQLiteExecutor {
  runAsync(source: string, params?: SQLite.SQLiteBindValue[]): Promise<SQLite.SQLiteRunResult>;
  getAllAsync<T>(source: string, params?: SQLite.SQLiteBindValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: SQLite.SQLiteBindValue[]): Promise<T | null>;
  execAsync(source: string): Promise<void>;
}

let database: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

interface Migration {
  version: number;
  name: string;
  statements: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    statements: `
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        username      TEXT    NOT NULL UNIQUE,
        name          TEXT    NOT NULL,
        role          TEXT    NOT NULL CHECK (role IN ('admin','cashier')),
        password_hash TEXT    NOT NULL,
        password_salt TEXT    NOT NULL,
        is_active     INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT    NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode        TEXT    NOT NULL UNIQUE,
        name           TEXT    NOT NULL,
        category       TEXT,
        purchase_price INTEGER NOT NULL DEFAULT 0,
        selling_price  INTEGER NOT NULL DEFAULT 0,
        tax_rate       REAL    NOT NULL DEFAULT 0,
        stock_qty      INTEGER NOT NULL DEFAULT 0,
        image_uri      TEXT,
        is_active      INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT    NOT NULL,
        updated_at     TEXT    NOT NULL
      );

      -- Scanning looks up by barcode thousands of times a day (guide §6).
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);
      CREATE INDEX IF NOT EXISTS idx_products_name     ON products (name);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);

      CREATE TABLE IF NOT EXISTS invoices (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_no     TEXT    NOT NULL UNIQUE,
        customer_name  TEXT,
        subtotal       INTEGER NOT NULL,
        discount       INTEGER NOT NULL DEFAULT 0,
        tax            INTEGER NOT NULL DEFAULT 0,
        grand_total    INTEGER NOT NULL,
        amount_paid    INTEGER NOT NULL DEFAULT 0,
        payment_status TEXT    NOT NULL DEFAULT 'paid',
        payment_method TEXT    NOT NULL DEFAULT 'cash',
        cashier_id     INTEGER REFERENCES users (id) ON DELETE SET NULL,
        cashier_name   TEXT,
        note           TEXT,
        created_at     TEXT    NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices (created_at);
      CREATE INDEX IF NOT EXISTS idx_invoices_status  ON invoices (payment_status);

      CREATE TABLE IF NOT EXISTS invoice_items (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id     INTEGER NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
        product_id     INTEGER REFERENCES products (id) ON DELETE SET NULL,
        -- name and price are COPIED at sale time so an old bill never changes
        -- when a product is repriced (guide §6, schema rule 1).
        product_name   TEXT    NOT NULL,
        barcode        TEXT    NOT NULL,
        quantity       INTEGER NOT NULL,
        unit_price     INTEGER NOT NULL,
        discount_share INTEGER NOT NULL DEFAULT 0,
        tax_rate       REAL    NOT NULL DEFAULT 0,
        tax            INTEGER NOT NULL DEFAULT 0,
        line_total     INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items (product_id);

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      -- Auto-saved in-progress cart, so a crash mid-sale loses nothing
      -- (guide §9.8). One row, id = 1.
      CREATE TABLE IF NOT EXISTS cart_draft (
        id         INTEGER PRIMARY KEY CHECK (id = 1),
        payload    TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

/** Wraps any SQLite failure as a typed DatabaseError (guide §9.3). */
export async function guardDb<T>(
  operation: string,
  work: () => Promise<T>,
  context?: Record<string, unknown>,
): Promise<T> {
  try {
    return await work();
  } catch (error) {
    logger.error(`Database operation failed: ${operation}`, error, context);
    throw new DatabaseError(`${operation} failed`, { cause: error, context });
  }
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  if (pending.length === 0) {
    logger.debug('Database schema up to date', { version: currentVersion });
    return;
  }

  for (const migration of pending) {
    logger.info(`Applying migration ${migration.version}: ${migration.name}`);
    // execAsync already runs the batch atomically per statement group; the
    // version bump goes with it so a failure leaves the version untouched.
    await db.withTransactionAsync(async () => {
      await db.execAsync(migration.statements);
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

async function seedDefaultSettings(db: SQLite.SQLiteDatabase): Promise<void> {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.runAsync('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
}

/**
 * Opens (once) and returns the shared connection. Safe to call concurrently —
 * callers race on the same promise rather than opening twice.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return Promise.resolve(database);
  if (initPromise) return initPromise;

  initPromise = guardDb('open database', async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    // WAL keeps reads fast while a checkout is writing.
    await db.execAsync('PRAGMA journal_mode = WAL;');
    // Off by default in SQLite; we rely on the invoice_items cascade.
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await runMigrations(db);
    await seedDefaultSettings(db);
    database = db;
    logger.info('Database ready', { name: DB_NAME });
    return db;
  }).catch((error) => {
    // Let a later call retry instead of caching the failure forever.
    initPromise = null;
    throw error;
  });

  return initPromise;
}

/** Test/teardown helper. */
export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.closeAsync();
    database = null;
    initPromise = null;
  }
}

/** Wipes all rows but keeps the schema. Used by the "reset data" setting. */
export async function resetDatabase(): Promise<void> {
  const db = await getDatabase();
  await guardDb('reset database', async () => {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM invoice_items;
        DELETE FROM invoices;
        DELETE FROM products;
        DELETE FROM cart_draft;
      `);
    });
    await db.runAsync('UPDATE settings SET value = ? WHERE key = ?', ['0', 'invoice_sequence']);
  });
}
