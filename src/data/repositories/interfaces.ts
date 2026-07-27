/**
 * Repository contracts (guide §5, dependency inversion).
 *
 * Screens and services depend on these interfaces, never on the SQLite
 * classes. When cloud sync arrives, a `SupabaseProductRepository` implements
 * the same shape and nothing above the data layer changes.
 */

import { Cart } from '../../domain/Cart';
import { Invoice, PaymentStatus } from '../../domain/Invoice';
import { Product } from '../../domain/Product';
import { User, UserRole } from '../../domain/User';
import { Money } from '../../domain/Money';

export interface ProductQuery {
  search?: string;
  category?: string;
  lowStockThreshold?: number;
  onlyLowStock?: boolean;
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
}

export interface IProductRepository {
  findById(id: number): Promise<Product | null>;
  /** The hot path — must stay instant, hence the barcode index. */
  findByBarcode(barcode: string): Promise<Product | null>;
  /** Throws NotFoundError instead of returning null. */
  requireByBarcode(barcode: string): Promise<Product>;
  list(query?: ProductQuery): Promise<Product[]>;
  count(query?: ProductQuery): Promise<number>;
  getLowStock(threshold: number): Promise<Product[]>;
  categories(): Promise<string[]>;
  create(product: Product): Promise<Product>;
  update(product: Product): Promise<Product>;
  /** Soft delete — keeps old invoice lines meaningful. */
  deactivate(id: number): Promise<void>;
  delete(id: number): Promise<void>;
  existsByBarcode(barcode: string, excludeId?: number): Promise<boolean>;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface InvoiceQuery {
  search?: string;
  status?: PaymentStatus | 'all';
  range?: DateRange;
  limit?: number;
  offset?: number;
}

export interface IInvoiceRepository {
  findById(id: number): Promise<Invoice | null>;
  findByNumber(invoiceNo: string): Promise<Invoice | null>;
  list(query?: InvoiceQuery): Promise<Invoice[]>;
  count(query?: InvoiceQuery): Promise<number>;
  updatePaymentStatus(id: number, status: PaymentStatus, amountPaid?: Money): Promise<void>;
}

export interface IUserRepository {
  findByUsername(username: string): Promise<User | null>;
  findById(id: number): Promise<User | null>;
  list(): Promise<User[]>;
  count(): Promise<number>;
  create(user: User, password: string): Promise<User>;
  verifyPassword(username: string, password: string): Promise<User | null>;
  changePassword(userId: number, newPassword: string): Promise<void>;
  setRole(userId: number, role: UserRole): Promise<void>;
  deactivate(userId: number): Promise<void>;
}

export interface ISettingsRepository {
  get(key: string): Promise<string | null>;
  getNumber(key: string, fallback: number): Promise<number>;
  getBoolean(key: string, fallback: boolean): Promise<boolean>;
  set(key: string, value: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
  setMany(values: Record<string, string>): Promise<void>;
}

/** Auto-save for the in-progress cart (guide §9.8). */
export interface ICartDraftRepository {
  save(cart: Cart): Promise<void>;
  load(): Promise<Cart | null>;
  clear(): Promise<void>;
}

export interface DailySales {
  date: string;
  billCount: number;
  total: Money;
}

export interface TopProduct {
  productName: string;
  barcode: string;
  unitsSold: number;
  revenue: Money;
}

export interface SalesSummary {
  billCount: number;
  total: Money;
  unitsSold: number;
  averageBill: Money;
}

export interface IReportRepository {
  salesSummary(range: DateRange): Promise<SalesSummary>;
  dailySales(range: DateRange): Promise<DailySales[]>;
  topProducts(range: DateRange, limit: number): Promise<TopProduct[]>;
}
