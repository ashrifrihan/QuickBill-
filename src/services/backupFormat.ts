/**
 * The backup file FORMAT: schema, checksum and validation.
 *
 * Deliberately free of any Expo/native import so it stays pure — this is the
 * code that decides whether a file is safe to write over a shop's entire
 * history, so it must be exhaustively unit-testable without a device.
 * All file and share IO lives in BackupService.
 */

import * as z from 'zod';
import { ValidationError } from '../errors/AppError';
import { checksumOf } from '../utils/checksum';

export const BACKUP_FORMAT = 'quickbill-backup';
export const BACKUP_VERSION = 1;

const wholeNumber = (label: string) =>
  z.number().refine((v) => Number.isInteger(v), { message: `${label} must be a whole number` });

const productSchema = z.object({
  id: z.number(),
  barcode: z.string().min(1),
  name: z.string().min(1),
  category: z.string().nullable(),
  purchase_price: wholeNumber('purchase_price'),
  selling_price: wholeNumber('selling_price'),
  tax_rate: z.number(),
  stock_qty: wholeNumber('stock_qty'),
  image_uri: z.string().nullable(),
  is_active: wholeNumber('is_active'),
  created_at: z.string(),
  updated_at: z.string(),
});

const invoiceSchema = z.object({
  id: z.number(),
  invoice_no: z.string().min(1),
  customer_name: z.string().nullable(),
  subtotal: wholeNumber('subtotal'),
  discount: wholeNumber('discount'),
  tax: wholeNumber('tax'),
  grand_total: wholeNumber('grand_total'),
  amount_paid: wholeNumber('amount_paid'),
  payment_status: z.string(),
  payment_method: z.string(),
  cashier_id: z.number().nullable(),
  cashier_name: z.string().nullable(),
  note: z.string().nullable(),
  created_at: z.string(),
});

const invoiceItemSchema = z.object({
  id: z.number(),
  invoice_id: z.number(),
  product_id: z.number().nullable(),
  product_name: z.string().min(1),
  barcode: z.string(),
  quantity: wholeNumber('quantity'),
  unit_price: wholeNumber('unit_price'),
  discount_share: wholeNumber('discount_share'),
  tax_rate: z.number(),
  tax: wholeNumber('tax'),
  line_total: wholeNumber('line_total'),
});

const userSchema = z.object({
  id: z.number(),
  username: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  password_hash: z.string(),
  password_salt: z.string(),
  is_active: wholeNumber('is_active'),
  created_at: z.string(),
});

const settingSchema = z.object({ key: z.string().min(1), value: z.string() });

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number(),
  exportedAt: z.string(),
  app: z.object({ name: z.string(), version: z.string() }).optional(),
  shop: z.string().optional(),
  counts: z.object({
    products: z.number(),
    invoices: z.number(),
    invoiceItems: z.number(),
    users: z.number(),
    settings: z.number(),
  }),
  checksum: z.string(),
  data: z.object({
    products: z.array(productSchema),
    invoices: z.array(invoiceSchema),
    invoiceItems: z.array(invoiceItemSchema),
    users: z.array(userSchema),
    settings: z.array(settingSchema),
  }),
});

export type BackupFile = z.infer<typeof backupSchema>;
export type BackupData = BackupFile['data'];

export interface BackupSummary {
  products: number;
  invoices: number;
  invoiceItems: number;
  users: number;
  settings: number;
  exportedAt: string;
  shop?: string;
}

/**
 * Serialisation used for the checksum.
 *
 * Key order is pinned here rather than relying on object-literal order, so the
 * value computed on export matches the one computed on import exactly.
 */
export function canonicalise(data: BackupData): string {
  return JSON.stringify([
    data.products,
    data.invoices,
    data.invoiceItems,
    data.users,
    data.settings,
  ]);
}

export function summaryOf(backup: BackupFile): BackupSummary {
  return { ...backup.counts, exportedAt: backup.exportedAt, shop: backup.shop };
}

/**
 * Validates raw file text. Throws a ValidationError carrying a message the
 * shopkeeper can act on; never returns partially-trusted data.
 */
export function parseBackup(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('Backup file is not valid JSON', {
      userMessage: 'That file is not a QuickBill backup.',
    });
  }

  // Checked before the full schema so an unrelated JSON file produces a
  // sensible message instead of a wall of field errors.
  const tag = (parsed as { format?: unknown })?.format;
  if (tag !== BACKUP_FORMAT) {
    throw new ValidationError(`Unexpected format tag: ${String(tag)}`, {
      userMessage: 'That file is not a QuickBill backup.',
    });
  }

  const rawVersion = (parsed as { version?: unknown })?.version;
  if (typeof rawVersion === 'number' && rawVersion > BACKUP_VERSION) {
    throw new ValidationError(`Backup version ${rawVersion} is newer than ${BACKUP_VERSION}`, {
      userMessage:
        'This backup was made by a newer version of QuickBill. Update the app, then import it.',
    });
  }

  const result = backupSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const where = first?.path.join('.') || 'file';
    throw new ValidationError(`Backup validation failed at ${where}`, {
      userMessage: `This backup is damaged (problem at "${where}"). Try an earlier backup.`,
      context: { issues: result.error.issues.slice(0, 5) },
    });
  }

  const backup = result.data;

  // Counts catch a truncated file that still happens to parse as valid JSON.
  const actual = {
    products: backup.data.products.length,
    invoices: backup.data.invoices.length,
    invoiceItems: backup.data.invoiceItems.length,
    users: backup.data.users.length,
    settings: backup.data.settings.length,
  };
  for (const key of Object.keys(actual) as (keyof typeof actual)[]) {
    if (actual[key] !== backup.counts[key]) {
      throw new ValidationError(
        `Count mismatch for ${key}: header says ${backup.counts[key]}, file has ${actual[key]}`,
        { userMessage: 'This backup is incomplete — it may not have finished downloading.' },
      );
    }
  }

  // Checksum catches silent corruption that still satisfies the schema.
  const expected = checksumOf(canonicalise(backup.data));
  if (expected !== backup.checksum) {
    throw new ValidationError(
      `Checksum mismatch: expected ${expected}, file has ${backup.checksum}`,
      { userMessage: 'This backup appears to be corrupted and was not imported.' },
    );
  }

  return backup;
}
