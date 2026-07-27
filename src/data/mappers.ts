/**
 * Row shapes and row → model translation.
 *
 * Keeping this separate means SQL column names (snake_case) never leak into
 * the domain, and the domain's camelCase never leaks into SQL.
 */

import { Product } from '../domain/Product';
import { Invoice, InvoiceItem, PaymentMethod, PaymentStatus } from '../domain/Invoice';
import { User, UserRole } from '../domain/User';

export interface ProductRow {
  id: number;
  barcode: string;
  name: string;
  category: string | null;
  purchase_price: number;
  selling_price: number;
  tax_rate: number;
  stock_qty: number;
  image_uri: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRow {
  id: number;
  invoice_no: string;
  customer_name: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  grand_total: number;
  amount_paid: number;
  payment_status: string;
  payment_method: string;
  cashier_id: number | null;
  cashier_name: string | null;
  note: string | null;
  created_at: string;
}

export interface InvoiceItemRow {
  id: number;
  invoice_id: number;
  product_id: number | null;
  product_name: string;
  barcode: string;
  quantity: number;
  unit_price: number;
  discount_share: number;
  tax_rate: number;
  tax: number;
  line_total: number;
}

export interface UserRow {
  id: number;
  username: string;
  name: string;
  role: string;
  password_hash: string;
  password_salt: string;
  is_active: number;
  created_at: string;
}

export function toProduct(row: ProductRow): Product {
  return new Product({
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    taxRate: row.tax_rate,
    stockQty: row.stock_qty,
    imageUri: row.image_uri,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function toInvoiceItem(row: InvoiceItemRow): InvoiceItem {
  return new InvoiceItem({
    id: row.id,
    invoiceId: row.invoice_id,
    productId: row.product_id,
    productName: row.product_name,
    barcode: row.barcode,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    discountShare: row.discount_share,
    taxRate: row.tax_rate,
    tax: row.tax,
    lineTotal: row.line_total,
  });
}

export function toInvoice(row: InvoiceRow, itemRows: InvoiceItemRow[]): Invoice {
  return new Invoice({
    id: row.id,
    invoiceNo: row.invoice_no,
    customerName: row.customer_name,
    items: itemRows.map(toInvoiceItem),
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    grandTotal: row.grand_total,
    amountPaid: row.amount_paid,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentMethod: row.payment_method as PaymentMethod,
    cashierId: row.cashier_id,
    cashierName: row.cashier_name,
    note: row.note,
    createdAt: row.created_at,
  });
}

export function toUser(row: UserRow): User {
  return new User({
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as UserRole,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  });
}
