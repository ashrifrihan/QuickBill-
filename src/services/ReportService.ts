/**
 * Dashboard and report aggregation (guide §8.7).
 *
 * Results are cached per range key and invalidated whenever a bill is saved,
 * so opening the dashboard repeatedly doesn't re-run the aggregates.
 */

import { productRepository, reportRepository, settingsRepository } from '../data';
import { DailySales, DateRange, SalesSummary, TopProduct } from '../data/repositories/interfaces';
import { Product } from '../domain/Product';
import { SETTINGS_KEYS, DEFAULT_LOW_STOCK_THRESHOLD } from '../config/constants';
import { lastNDaysRange, todayRange } from '../utils/format';

export interface DashboardData {
  today: SalesSummary;
  week: SalesSummary;
  lowStock: Product[];
  topProducts: TopProduct[];
  trend: DailySales[];
}

export class ReportService {
  private cache = new Map<string, { value: unknown; at: number }>();
  private readonly ttlMs = 30_000;

  /** Called after every checkout so the next read recomputes. */
  invalidate(): void {
    this.cache.clear();
  }

  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) {
      return hit.value as T;
    }
    const value = await load();
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  async lowStockThreshold(): Promise<number> {
    return settingsRepository.getNumber(
      SETTINGS_KEYS.lowStockThreshold,
      DEFAULT_LOW_STOCK_THRESHOLD,
    );
  }

  summary(range: DateRange): Promise<SalesSummary> {
    return this.cached(`summary:${range.from}:${range.to}`, () =>
      reportRepository.salesSummary(range),
    );
  }

  dailySales(range: DateRange): Promise<DailySales[]> {
    return this.cached(`daily:${range.from}:${range.to}`, () => reportRepository.dailySales(range));
  }

  topProducts(range: DateRange, limit = 5): Promise<TopProduct[]> {
    return this.cached(`top:${range.from}:${range.to}:${limit}`, () =>
      reportRepository.topProducts(range, limit),
    );
  }

  async lowStock(): Promise<Product[]> {
    const threshold = await this.lowStockThreshold();
    return this.cached(`lowstock:${threshold}`, () => productRepository.getLowStock(threshold));
  }

  /** One call for the whole dashboard, run in parallel. */
  async dashboard(): Promise<DashboardData> {
    const today = todayRange();
    const week = lastNDaysRange(7);

    const [todaySummary, weekSummary, lowStock, topProducts, trend] = await Promise.all([
      this.summary(today),
      this.summary(week),
      this.lowStock(),
      this.topProducts(week, 5),
      this.dailySales(week),
    ]);

    return { today: todaySummary, week: weekSummary, lowStock, topProducts, trend };
  }
}

export const reportService = new ReportService();
