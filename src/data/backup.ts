/**
 * Raw table dump and restore for backup files.
 *
 * Lives in the data layer because it is the one place that legitimately reads
 * and writes every table directly. The service layer above decides *policy*
 * (what a backup means, how to validate it); this file only moves rows.
 *
 * The whole restore runs inside a single exclusive transaction — a half-applied
 * backup would be far worse than a failed one.
 */

import { getDatabase, guardDb, SQLiteExecutor } from './database';
import { InvoiceItemRow, InvoiceRow, ProductRow, UserRow } from './mappers';
import { logger } from '../errors/logger';

export interface SettingRow {
  key: string;
  value: string;
}

export interface BackupTables {
  products: ProductRow[];
  invoices: InvoiceRow[];
  invoiceItems: InvoiceItemRow[];
  users: UserRow[];
  settings: SettingRow[];
}

export interface RestoreOutcome {
  products: number;
  invoices: number;
  invoiceItems: number;
  users: number;
  settings: number;
  /** Rows deliberately not written, with the reason. */
  skipped: string[];
}

/** Reads every table. Ordered by id so exports of the same data are identical. */
export async function dumpAllTables(): Promise<BackupTables> {
  const db = await getDatabase();

  return guardDb('dump tables for backup', async () => {
    const [products, invoices, invoiceItems, users, settings] = await Promise.all([
      db.getAllAsync<ProductRow>('SELECT * FROM products ORDER BY id ASC'),
      db.getAllAsync<InvoiceRow>('SELECT * FROM invoices ORDER BY id ASC'),
      db.getAllAsync<InvoiceItemRow>('SELECT * FROM invoice_items ORDER BY id ASC'),
      db.getAllAsync<UserRow>('SELECT * FROM users ORDER BY id ASC'),
      db.getAllAsync<SettingRow>('SELECT key, value FROM settings ORDER BY key ASC'),
    ]);

    return { products, invoices, invoiceItems, users, settings };
  });
}

async function insertProduct(txn: SQLiteExecutor, row: ProductRow): Promise<number> {
  const result = await txn.runAsync(
    `INSERT INTO products
       (barcode, name, category, purchase_price, selling_price, tax_rate,
        stock_qty, image_uri, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.barcode,
      row.name,
      row.category,
      row.purchase_price,
      row.selling_price,
      row.tax_rate,
      row.stock_qty,
      // Image files are NOT inside the backup, so a path from another device
      // would point at nothing. Dropping it keeps the catalogue consistent.
      null,
      row.is_active,
      row.created_at,
      row.updated_at,
    ],
  );
  return result.lastInsertRowId;
}

async function insertInvoice(txn: SQLiteExecutor, row: InvoiceRow): Promise<number> {
  const result = await txn.runAsync(
    `INSERT INTO invoices
       (invoice_no, customer_name, subtotal, discount, tax, grand_total, amount_paid,
        payment_status, payment_method, cashier_id, cashier_name, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.invoice_no,
      row.customer_name,
      row.subtotal,
      row.discount,
      row.tax,
      row.grand_total,
      row.amount_paid,
      row.payment_status,
      row.payment_method,
      // Cashier ids belong to the source device's user table; the name is
      // already copied onto the invoice, so the link is dropped rather than
      // pointed at whoever happens to hold that id here.
      null,
      row.cashier_name,
      row.note,
      row.created_at,
    ],
  );
  return result.lastInsertRowId;
}

async function insertInvoiceItem(
  txn: SQLiteExecutor,
  row: InvoiceItemRow,
  invoiceId: number,
  productId: number | null,
): Promise<void> {
  await txn.runAsync(
    `INSERT INTO invoice_items
       (invoice_id, product_id, product_name, barcode, quantity,
        unit_price, discount_share, tax_rate, tax, line_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      invoiceId,
      productId,
      row.product_name,
      row.barcode,
      row.quantity,
      row.unit_price,
      row.discount_share,
      row.tax_rate,
      row.tax,
      row.line_total,
    ],
  );
}

/**
 * Writes a validated backup into the database.
 *
 * `replace` wipes products, bills and settings first — a true restore.
 * `merge` keeps what is here: products are matched by barcode and updated,
 * bills already present (same invoice number) are left untouched so a financial
 * record can never be duplicated by importing the same file twice.
 *
 * Row ids are NEVER reused. They are reallocated on insert and the foreign keys
 * are remapped, because the ids in the file belong to a different database.
 */
export async function restoreTables(
  tables: BackupTables,
  mode: 'replace' | 'merge',
  options: { includeUsers: boolean },
): Promise<RestoreOutcome> {
  const db = await getDatabase();
  const outcome: RestoreOutcome = {
    products: 0,
    invoices: 0,
    invoiceItems: 0,
    users: 0,
    settings: 0,
    skipped: [],
  };

  await guardDb(`restore backup (${mode})`, async () => {
    await db.withExclusiveTransactionAsync(async (txn) => {
      if (mode === 'replace') {
        // Order matters: children before parents, even with ON DELETE CASCADE.
        await txn.execAsync(`
          DELETE FROM invoice_items;
          DELETE FROM invoices;
          DELETE FROM products;
          DELETE FROM cart_draft;
        `);
        if (options.includeUsers) await txn.execAsync('DELETE FROM users;');
      }

      // ---- products -----------------------------------------------------
      // barcode → id in THIS database, used to relink invoice lines.
      const productIdByBarcode = new Map<string, number>();

      if (mode === 'merge') {
        const existing = await txn.getAllAsync<{ id: number; barcode: string }>(
          'SELECT id, barcode FROM products',
        );
        for (const row of existing) productIdByBarcode.set(row.barcode, row.id);
      }

      for (const product of tables.products) {
        const existingId = productIdByBarcode.get(product.barcode);

        if (existingId !== undefined) {
          // Same barcode already here: refresh its details rather than
          // inserting a duplicate the UNIQUE index would reject anyway.
          await txn.runAsync(
            `UPDATE products SET
               name = ?, category = ?, purchase_price = ?, selling_price = ?,
               tax_rate = ?, stock_qty = ?, is_active = ?, updated_at = ?
             WHERE id = ?`,
            [
              product.name,
              product.category,
              product.purchase_price,
              product.selling_price,
              product.tax_rate,
              product.stock_qty,
              product.is_active,
              product.updated_at,
              existingId,
            ],
          );
        } else {
          const newId = await insertProduct(txn, product);
          productIdByBarcode.set(product.barcode, newId);
        }
        outcome.products += 1;
      }

      // ---- invoices + their line items ----------------------------------
      const existingInvoiceNos = new Set(
        (
          await txn.getAllAsync<{ invoice_no: string }>('SELECT invoice_no FROM invoices')
        ).map((row) => row.invoice_no),
      );

      // Group lines by their ORIGINAL invoice id before remapping.
      const itemsByInvoiceId = new Map<number, InvoiceItemRow[]>();
      for (const item of tables.invoiceItems) {
        const bucket = itemsByInvoiceId.get(item.invoice_id);
        if (bucket) bucket.push(item);
        else itemsByInvoiceId.set(item.invoice_id, [item]);
      }

      let duplicateBills = 0;
      for (const invoice of tables.invoices) {
        if (existingInvoiceNos.has(invoice.invoice_no)) {
          duplicateBills += 1;
          continue;
        }

        const newInvoiceId = await insertInvoice(txn, invoice);
        existingInvoiceNos.add(invoice.invoice_no);
        outcome.invoices += 1;

        for (const item of itemsByInvoiceId.get(invoice.id) ?? []) {
          // A line whose product no longer exists still has its own copied
          // name and price, so the bill stays complete and correct.
          const productId = productIdByBarcode.get(item.barcode) ?? null;
          await insertInvoiceItem(txn, item, newInvoiceId, productId);
          outcome.invoiceItems += 1;
        }
      }
      if (duplicateBills > 0) {
        outcome.skipped.push(
          `${duplicateBills} bill${duplicateBills === 1 ? '' : 's'} already on this device`,
        );
      }

      // ---- users ---------------------------------------------------------
      if (options.includeUsers) {
        for (const user of tables.users) {
          const clash = await txn.getFirstAsync<{ id: number }>(
            'SELECT id FROM users WHERE username = ?',
            [user.username],
          );
          if (clash) {
            outcome.skipped.push(`account "${user.username}" already exists`);
            continue;
          }
          await txn.runAsync(
            `INSERT INTO users (username, name, role, password_hash, password_salt, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              user.username,
              user.name,
              user.role,
              user.password_hash,
              user.password_salt,
              user.is_active,
              user.created_at,
            ],
          );
          outcome.users += 1;
        }
      }

      // ---- settings ------------------------------------------------------
      // On merge the shop's own configuration is left alone; only the invoice
      // sequence is reconciled below.
      if (mode === 'replace') {
        for (const setting of tables.settings) {
          await txn.runAsync(
            `INSERT INTO settings (key, value) VALUES (?, ?)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
            [setting.key, setting.value],
          );
          outcome.settings += 1;
        }
      }

      // ---- invoice numbering ---------------------------------------------
      // Critical: if the sequence stayed below the highest imported bill, the
      // next sale would mint an invoice number that already exists.
      const backupSequence = Number(
        tables.settings.find((s) => s.key === 'invoice_sequence')?.value ?? '0',
      );
      const currentRow = await txn.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'invoice_sequence'",
      );
      const currentSequence = Number(currentRow?.value ?? '0');

      const nextSequence = Math.max(
        Number.isFinite(backupSequence) ? backupSequence : 0,
        Number.isFinite(currentSequence) ? currentSequence : 0,
      );
      await txn.runAsync(
        `INSERT INTO settings (key, value) VALUES ('invoice_sequence', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [String(nextSequence)],
      );
    });
  });

  logger.info('Backup restored', { mode, ...outcome, skipped: outcome.skipped.length });
  return outcome;
}
