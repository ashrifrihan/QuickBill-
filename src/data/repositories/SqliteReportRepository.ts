/**
 * Reporting queries.
 *
 * Every figure here is produced by a SQL aggregate, never by loading rows into
 * JavaScript and summing them (guide §8.7). That keeps reports fast once the
 * shop has tens of thousands of bills.
 */

import { getDatabase, guardDb } from '../database';
import { DailySales, DateRange, IReportRepository, SalesSummary, TopProduct } from './interfaces';

/** Sales figures exclude bills that were refunded. */
const COUNTED_STATUSES = "('paid', 'unpaid', 'partial')";

export class SqliteReportRepository implements IReportRepository {
  async salesSummary(range: DateRange): Promise<SalesSummary> {
    const db = await getDatabase();
    return guardDb('salesSummary', async () => {
      // Two separate aggregates on purpose. Joining invoices to invoice_items
      // fans out one row per line, which would multiply grand_total by the
      // number of lines on the bill.
      const billRow = await db.getFirstAsync<{ total: number; bill_count: number }>(
        `SELECT COALESCE(SUM(grand_total), 0) AS total, COUNT(*) AS bill_count
         FROM invoices
         WHERE created_at BETWEEN ? AND ? AND payment_status IN ${COUNTED_STATUSES}`,
        [range.from, range.to],
      );

      const unitRow = await db.getFirstAsync<{ units: number }>(
        `SELECT COALESCE(SUM(ii.quantity), 0) AS units
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         WHERE i.created_at BETWEEN ? AND ? AND i.payment_status IN ${COUNTED_STATUSES}`,
        [range.from, range.to],
      );

      const billCount = billRow?.bill_count ?? 0;
      const total = billRow?.total ?? 0;

      return {
        billCount,
        total,
        unitsSold: unitRow?.units ?? 0,
        averageBill: billCount > 0 ? Math.round(total / billCount) : 0,
      };
    });
  }

  async dailySales(range: DateRange): Promise<DailySales[]> {
    const db = await getDatabase();
    return guardDb('dailySales', async () => {
      const rows = await db.getAllAsync<{ date: string; bill_count: number; total: number }>(
        `SELECT DATE(created_at)              AS date,
                COUNT(*)                      AS bill_count,
                COALESCE(SUM(grand_total), 0) AS total
         FROM invoices
         WHERE created_at BETWEEN ? AND ? AND payment_status IN ${COUNTED_STATUSES}
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [range.from, range.to],
      );
      return rows.map((r) => ({ date: r.date, billCount: r.bill_count, total: r.total }));
    });
  }

  async topProducts(range: DateRange, limit = 5): Promise<TopProduct[]> {
    const db = await getDatabase();
    return guardDb('topProducts', async () => {
      const rows = await db.getAllAsync<{
        product_name: string;
        barcode: string;
        units: number;
        revenue: number;
      }>(
        `SELECT ii.product_name                     AS product_name,
                ii.barcode                          AS barcode,
                SUM(ii.quantity)                    AS units,
                COALESCE(SUM(ii.line_total), 0)     AS revenue
         FROM invoice_items ii
         JOIN invoices i ON i.id = ii.invoice_id
         WHERE i.created_at BETWEEN ? AND ? AND i.payment_status IN ${COUNTED_STATUSES}
         GROUP BY ii.barcode, ii.product_name
         ORDER BY units DESC, revenue DESC
         LIMIT ?`,
        [range.from, range.to, limit],
      );
      return rows.map((r) => ({
        productName: r.product_name,
        barcode: r.barcode,
        unitsSold: r.units,
        revenue: r.revenue,
      }));
    });
  }
}
