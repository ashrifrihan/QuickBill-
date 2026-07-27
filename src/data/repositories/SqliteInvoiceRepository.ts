import { getDatabase, guardDb, SQLiteExecutor } from '../database';
import { IInvoiceRepository, InvoiceQuery } from './interfaces';
import { InvoiceItemRow, InvoiceRow, toInvoice } from '../mappers';
import { Invoice, PaymentStatus } from '../../domain/Invoice';
import { Money } from '../../domain/Money';
import { NotFoundError, ValidationError } from '../../errors/AppError';

const INVOICE_COLUMNS = `id, invoice_no, customer_name, subtotal, discount, tax, grand_total,
                         amount_paid, payment_status, payment_method, cashier_id, cashier_name,
                         note, created_at`;

const ITEM_COLUMNS = `id, invoice_id, product_id, product_name, barcode, quantity,
                      unit_price, discount_share, tax_rate, tax, line_total`;

export class SqliteInvoiceRepository implements IInvoiceRepository {
  constructor(private readonly executor?: SQLiteExecutor) {}

  private async db(): Promise<SQLiteExecutor> {
    return this.executor ?? (await getDatabase());
  }

  private buildFilter(query: InvoiceQuery = {}): { clause: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (query.status && query.status !== 'all') {
      conditions.push('payment_status = ?');
      params.push(query.status);
    }

    if (query.range) {
      conditions.push('created_at BETWEEN ? AND ?');
      params.push(query.range.from, query.range.to);
    }

    if (query.search?.trim()) {
      conditions.push('(invoice_no LIKE ? OR customer_name LIKE ?)');
      const like = `%${query.search.trim()}%`;
      params.push(like, like);
    }

    return {
      clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    };
  }

  /** Loads line items for a set of invoices in one query, not N. */
  private async loadItems(invoiceIds: number[]): Promise<Map<number, InvoiceItemRow[]>> {
    const grouped = new Map<number, InvoiceItemRow[]>();
    if (invoiceIds.length === 0) return grouped;

    const db = await this.db();
    const placeholders = invoiceIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<InvoiceItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM invoice_items WHERE invoice_id IN (${placeholders}) ORDER BY id ASC`,
      invoiceIds,
    );

    for (const row of rows) {
      const bucket = grouped.get(row.invoice_id);
      if (bucket) bucket.push(row);
      else grouped.set(row.invoice_id, [row]);
    }
    return grouped;
  }

  async findById(id: number): Promise<Invoice | null> {
    const db = await this.db();
    return guardDb('findById(invoice)', async () => {
      const row = await db.getFirstAsync<InvoiceRow>(
        `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE id = ?`,
        [id],
      );
      if (!row) return null;
      const items = await this.loadItems([row.id]);
      return toInvoice(row, items.get(row.id) ?? []);
    });
  }

  async findByNumber(invoiceNo: string): Promise<Invoice | null> {
    const db = await this.db();
    return guardDb('findByNumber(invoice)', async () => {
      const row = await db.getFirstAsync<InvoiceRow>(
        `SELECT ${INVOICE_COLUMNS} FROM invoices WHERE invoice_no = ?`,
        [invoiceNo.trim()],
      );
      if (!row) return null;
      const items = await this.loadItems([row.id]);
      return toInvoice(row, items.get(row.id) ?? []);
    });
  }

  async list(query: InvoiceQuery = {}): Promise<Invoice[]> {
    const db = await this.db();
    const { clause, params } = this.buildFilter(query);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    return guardDb('list(invoices)', async () => {
      const rows = await db.getAllAsync<InvoiceRow>(
        `SELECT ${INVOICE_COLUMNS} FROM invoices ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      const items = await this.loadItems(rows.map((r) => r.id));
      return rows.map((row) => toInvoice(row, items.get(row.id) ?? []));
    });
  }

  async count(query: InvoiceQuery = {}): Promise<number> {
    const db = await this.db();
    const { clause, params } = this.buildFilter(query);
    return guardDb('count(invoices)', async () => {
      const row = await db.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total FROM invoices ${clause}`,
        params,
      );
      return row?.total ?? 0;
    });
  }

  /**
   * Writes the invoice header and every line. Called by BillingService from
   * inside its transaction — never call this on its own, or a failure halfway
   * through would leave an invoice with missing lines.
   */
  async create(invoice: Invoice): Promise<Invoice> {
    const db = await this.db();
    return guardDb(
      'create(invoice)',
      async () => {
        const header = await db.runAsync(
          `INSERT INTO invoices
             (invoice_no, customer_name, subtotal, discount, tax, grand_total, amount_paid,
              payment_status, payment_method, cashier_id, cashier_name, note, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoice.invoiceNo,
            invoice.customerName,
            invoice.subtotal,
            invoice.discount,
            invoice.tax,
            invoice.grandTotal,
            invoice.amountPaid,
            invoice.paymentStatus,
            invoice.paymentMethod,
            invoice.cashierId,
            invoice.cashierName,
            invoice.note,
            invoice.createdAt,
          ],
        );

        const invoiceId = header.lastInsertRowId;

        for (const item of invoice.items) {
          await db.runAsync(
            `INSERT INTO invoice_items
               (invoice_id, product_id, product_name, barcode, quantity,
                unit_price, discount_share, tax_rate, tax, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              invoiceId,
              item.productId,
              item.productName,
              item.barcode,
              item.quantity,
              item.unitPrice,
              item.discountShare,
              item.taxRate,
              item.tax,
              item.lineTotal,
            ],
          );
        }

        return new Invoice({ ...invoice.toProps(), id: invoiceId });
      },
      { invoiceNo: invoice.invoiceNo },
    );
  }

  async updatePaymentStatus(
    id: number,
    status: PaymentStatus,
    amountPaid?: Money,
  ): Promise<void> {
    const db = await this.db();
    await guardDb(
      'updatePaymentStatus',
      async () => {
        const result =
          amountPaid === undefined
            ? await db.runAsync('UPDATE invoices SET payment_status = ? WHERE id = ?', [status, id])
            : await db.runAsync(
                'UPDATE invoices SET payment_status = ?, amount_paid = ? WHERE id = ?',
                [status, amountPaid, id],
              );
        if (result.changes === 0) throw new NotFoundError('Invoice', String(id));
      },
      { id, status },
    );
  }

  /**
   * Allocates the next invoice sequence number. MUST be called inside the
   * checkout transaction — that is what makes duplicate invoice numbers
   * impossible (guide §8.5, §16).
   */
  async nextSequence(): Promise<number> {
    const db = await this.db();
    return guardDb('nextSequence', async () => {
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'invoice_sequence'",
      );
      const current = Number(row?.value ?? '0');
      if (!Number.isFinite(current)) {
        throw new ValidationError(`Corrupt invoice sequence: ${row?.value}`);
      }
      const next = current + 1;
      await db.runAsync("UPDATE settings SET value = ? WHERE key = 'invoice_sequence'", [
        String(next),
      ]);
      return next;
    });
  }
}
