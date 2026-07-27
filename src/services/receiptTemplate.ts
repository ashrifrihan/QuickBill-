/**
 * The HTML receipt, used for both the PDF and the on-screen preview.
 *
 * Every figure here comes from the saved Invoice — which was itself built from
 * `Cart.totals()`. The printed bill therefore cannot disagree with the screen
 * (guide §16, "Bill total ≠ printed total").
 */

import { Invoice } from '../domain/Invoice';
import { formatMoney } from '../domain/Money';
import { escapeHtml, formatDateTime, formatPercent } from '../utils/format';

export interface ReceiptShopInfo {
  name: string;
  address?: string;
  phone?: string;
  currency: string;
}

export function buildReceiptHtml(invoice: Invoice, shop: ReceiptShopInfo): string {
  const money = (amount: number) => escapeHtml(formatMoney(amount, shop.currency));

  const rows = invoice.items
    .map(
      (item) => `
        <tr>
          <td class="name">
            ${escapeHtml(item.productName)}
            <span class="meta">${item.quantity} × ${money(item.unitPrice)}${
              item.taxRate > 0 ? ` · tax ${escapeHtml(formatPercent(item.taxRate))}` : ''
            }</span>
          </td>
          <td class="qty">${item.quantity}</td>
          <td class="amount">${money(item.lineTotal)}</td>
        </tr>`,
    )
    .join('');

  const optionalRow = (label: string, amount: number, show: boolean) =>
    show
      ? `<tr><td colspan="2">${escapeHtml(label)}</td><td class="amount">${money(amount)}</td></tr>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Roboto, sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 24px;
    font-size: 13px;
  }
  .receipt { max-width: 420px; margin: 0 auto; }
  header { text-align: center; border-bottom: 2px dashed #cbd5e1; padding-bottom: 14px; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: 0.5px; }
  .shop-meta { color: #64748b; font-size: 11px; line-height: 1.5; }
  .invoice-meta {
    display: flex; justify-content: space-between;
    font-size: 11px; color: #475569; margin: 14px 0;
  }
  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.6px; color: #64748b;
    border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;
  }
  tbody td { padding: 8px 0; vertical-align: top; border-bottom: 1px solid #f1f5f9; }
  .name { width: 60%; font-weight: 600; }
  .meta { display: block; font-weight: 400; color: #64748b; font-size: 11px; margin-top: 2px; }
  .qty { width: 12%; text-align: center; color: #475569; }
  .amount { width: 28%; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tfoot td { padding: 5px 0; }
  tfoot .grand td {
    border-top: 2px solid #0f172a; padding-top: 10px;
    font-size: 17px; font-weight: 700;
  }
  footer {
    margin-top: 20px; text-align: center; font-size: 11px;
    color: #64748b; border-top: 2px dashed #cbd5e1; padding-top: 14px;
  }
  .badge {
    display: inline-block; padding: 3px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .paid   { background: #dcfce7; color: #166534; }
  .unpaid { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>
  <div class="receipt">
    <header>
      <h1>${escapeHtml(shop.name)}</h1>
      <div class="shop-meta">
        ${shop.address ? `${escapeHtml(shop.address)}<br/>` : ''}
        ${shop.phone ? escapeHtml(shop.phone) : ''}
      </div>
    </header>

    <div class="invoice-meta">
      <div>
        <strong>${escapeHtml(invoice.invoiceNo)}</strong><br/>
        ${escapeHtml(formatDateTime(invoice.createdAt))}
      </div>
      <div style="text-align:right">
        <span class="badge ${invoice.isPaid() ? 'paid' : 'unpaid'}">
          ${escapeHtml(invoice.paymentStatus)}
        </span><br/>
        ${invoice.cashierName ? `Served by ${escapeHtml(invoice.cashierName)}` : ''}
      </div>
    </div>

    ${
      invoice.customerName
        ? `<div class="invoice-meta"><div>Customer: <strong>${escapeHtml(
            invoice.customerName,
          )}</strong></div></div>`
        : ''
    }

    <table>
      <thead>
        <tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="2">Subtotal</td><td class="amount">${money(invoice.subtotal)}</td></tr>
        ${optionalRow('Discount', -invoice.discount, invoice.discount > 0)}
        ${optionalRow('Tax', invoice.tax, invoice.tax > 0)}
        <tr class="grand">
          <td colspan="2">Total</td>
          <td class="amount">${money(invoice.grandTotal)}</td>
        </tr>
        ${optionalRow('Paid', invoice.amountPaid, invoice.amountPaid > 0)}
        ${optionalRow('Change', invoice.changeDue(), invoice.changeDue() > 0)}
        ${optionalRow('Balance due', invoice.balanceDue(), invoice.balanceDue() > 0)}
      </tfoot>
    </table>

    <footer>
      ${invoice.note ? `${escapeHtml(invoice.note)}<br/><br/>` : ''}
      Thank you for your business!<br/>
      <span style="font-size:10px">${invoice.unitCount()} item(s) · Generated by QuickBill</span>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Plain-text version for 58mm/80mm ESC/POS thermal printers, which take
 * monospaced text rather than HTML.
 */
export function buildReceiptText(
  invoice: Invoice,
  shop: ReceiptShopInfo,
  width = 32,
): string {
  const line = (char = '-') => char.repeat(width);
  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  };
  const row = (left: string, right: string) => {
    const space = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };
  const money = (amount: number) => formatMoney(amount, shop.currency);

  const parts: string[] = [
    center(shop.name),
    ...(shop.address ? [center(shop.address)] : []),
    ...(shop.phone ? [center(shop.phone)] : []),
    line('='),
    invoice.invoiceNo,
    formatDateTime(invoice.createdAt),
    ...(invoice.customerName ? [`Customer: ${invoice.customerName}`] : []),
    line(),
  ];

  for (const item of invoice.items) {
    parts.push(item.productName.slice(0, width));
    parts.push(row(`  ${item.quantity} x ${money(item.unitPrice)}`, money(item.lineTotal)));
  }

  parts.push(line());
  parts.push(row('Subtotal', money(invoice.subtotal)));
  if (invoice.discount > 0) parts.push(row('Discount', `-${money(invoice.discount)}`));
  if (invoice.tax > 0) parts.push(row('Tax', money(invoice.tax)));
  parts.push(line('='));
  parts.push(row('TOTAL', money(invoice.grandTotal)));
  if (invoice.changeDue() > 0) parts.push(row('Change', money(invoice.changeDue())));
  if (invoice.balanceDue() > 0) parts.push(row('Balance', money(invoice.balanceDue())));
  parts.push(line('='));
  parts.push(center('Thank you!'));

  return parts.join('\n');
}
