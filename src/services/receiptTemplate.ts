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
          <td class="desc">
            ${escapeHtml(item.productName)}
            <span class="sub">${item.quantity} x ${money(item.unitPrice)}${
              item.taxRate > 0 ? ` (tax ${escapeHtml(formatPercent(item.taxRate))})` : ''
            }</span>
          </td>
          <td class="qty">${item.quantity}</td>
          <td class="cost">${money(item.lineTotal)}</td>
        </tr>`,
    )
    .join('');

  const totalRow = (label: string, amount: number, show: boolean, bold = false) =>
    show
      ? `<tr class="${bold ? 'grand' : ''}">
           <td colspan="2">${escapeHtml(label)}</td>
           <td class="cost">${money(amount)}</td>
         </tr>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  /*
    Deliberately plain: this is a till receipt, not a document. Monospace and
    dashed rules mean it reads the same whether it is shared as a PDF or sent
    to an 80mm thermal printer, and it stays legible photocopied or faxed.
  */
  * { box-sizing: border-box; }
  body {
    font-family: "Courier New", Courier, monospace;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 16px;
    font-size: 12px;
    line-height: 1.45;
  }
  .receipt { max-width: 320px; margin: 0 auto; }
  .center { text-align: center; }
  h1 {
    font-size: 16px;
    margin: 0 0 2px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .shop-meta { font-size: 11px; }
  .rule { border-top: 1px dashed #000; margin: 8px 0; }
  .meta { width: 100%; font-size: 11px; }
  .meta td { padding: 1px 0; }
  .meta td:last-child { text-align: right; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items thead th {
    font-size: 11px;
    text-align: left;
    text-transform: uppercase;
    border-bottom: 1px dashed #000;
    padding-bottom: 3px;
    font-weight: bold;
  }
  table.items td { padding: 4px 0; vertical-align: top; }
  .desc { width: 58%; }
  .sub { display: block; font-size: 10.5px; padding-left: 8px; }
  .qty { width: 12%; text-align: center; }
  .cost { width: 30%; text-align: right; white-space: nowrap; }
  tfoot td { padding: 2px 0; }
  tfoot .grand td {
    border-top: 1px dashed #000;
    padding-top: 5px;
    font-size: 14px;
    font-weight: bold;
  }
  .thanks { margin-top: 10px; font-size: 12px; letter-spacing: 1px; }
  .footnote { font-size: 10px; margin-top: 4px; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <h1>${escapeHtml(shop.name)}</h1>
      <div class="shop-meta">
        ${shop.address ? `${escapeHtml(shop.address)}<br/>` : ''}
        ${shop.phone ? escapeHtml(shop.phone) : ''}
      </div>
    </div>

    <div class="rule"></div>

    <table class="meta">
      <tr><td>Receipt :</td><td>${escapeHtml(invoice.invoiceNo)}</td></tr>
      <tr><td>Date :</td><td>${escapeHtml(formatDateTime(invoice.createdAt))}</td></tr>
      ${invoice.cashierName ? `<tr><td>Cashier :</td><td>${escapeHtml(invoice.cashierName)}</td></tr>` : ''}
      ${invoice.customerName ? `<tr><td>Customer :</td><td>${escapeHtml(invoice.customerName)}</td></tr>` : ''}
      <tr><td>Status :</td><td>${escapeHtml(invoice.paymentStatus.toUpperCase())}</td></tr>
    </table>

    <div class="rule"></div>

    <table class="items">
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align:center">Qty</th>
          <th style="text-align:right">Cost</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><td colspan="3"><div class="rule"></div></td></tr>
        ${totalRow('Sub Total', invoice.subtotal, true)}
        ${totalRow('Discount', -invoice.discount, invoice.discount > 0)}
        ${totalRow('Tax', invoice.tax, invoice.tax > 0)}
        ${totalRow('TOTAL', invoice.grandTotal, true, true)}
        ${totalRow('Paid', invoice.amountPaid, invoice.amountPaid > 0)}
        ${totalRow('Change', invoice.changeDue(), invoice.changeDue() > 0)}
        ${totalRow('Balance Due', invoice.balanceDue(), invoice.balanceDue() > 0)}
      </tfoot>
    </table>

    <div class="rule"></div>

    <div class="center">
      ${invoice.note ? `<div class="footnote">${escapeHtml(invoice.note)}</div>` : ''}
      <div class="thanks">THANK YOU FOR SHOPPING!</div>
      <div class="footnote">
        ${invoice.unitCount()} item(s) &middot; Paid by ${escapeHtml(invoice.paymentMethod)}
      </div>
      <div class="footnote">Generated by QuickBill</div>
    </div>
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
