/**
 * Typed access to the key/value settings table (guide §8.8), so screens never
 * deal in raw strings.
 */

import { settingsRepository } from '../data';
import { DEFAULT_LOW_STOCK_THRESHOLD, SETTINGS_KEYS } from '../config/constants';
import { ThemeMode } from '../config/theme';
import { PrinterStrategyId } from './PrinterService';
import { ReceiptShopInfo } from './receiptTemplate';

export interface AppSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  currency: string;
  /** Default tax rate as a fraction (0.15 = 15%) for new products. */
  taxRate: number;
  lowStockThreshold: number;
  invoicePrefix: string;
  printerStrategy: PrinterStrategyId;
  themeMode: ThemeMode;
  onboardingComplete: boolean;
}

export class SettingsService {
  async load(): Promise<AppSettings> {
    const raw = await settingsRepository.getAll();
    const num = (key: string, fallback: number) => {
      const parsed = Number(raw[key]);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    return {
      shopName: raw[SETTINGS_KEYS.shopName] || 'QuickBill Store',
      shopAddress: raw[SETTINGS_KEYS.shopAddress] || '',
      shopPhone: raw[SETTINGS_KEYS.shopPhone] || '',
      currency: raw[SETTINGS_KEYS.currency] || 'LKR',
      taxRate: num(SETTINGS_KEYS.taxRate, 0),
      lowStockThreshold: num(SETTINGS_KEYS.lowStockThreshold, DEFAULT_LOW_STOCK_THRESHOLD),
      invoicePrefix: raw[SETTINGS_KEYS.invoicePrefix] || 'INV',
      printerStrategy: (raw[SETTINGS_KEYS.printerStrategy] as PrinterStrategyId) || 'pdf',
      themeMode: (raw[SETTINGS_KEYS.themeMode] as ThemeMode) || 'light',
      onboardingComplete: raw[SETTINGS_KEYS.onboardingComplete] === 'true',
    };
  }

  async save(patch: Partial<AppSettings>): Promise<void> {
    const toWrite: Record<string, string> = {};
    const put = (key: string, value: unknown) => {
      if (value !== undefined) toWrite[key] = String(value);
    };

    put(SETTINGS_KEYS.shopName, patch.shopName);
    put(SETTINGS_KEYS.shopAddress, patch.shopAddress);
    put(SETTINGS_KEYS.shopPhone, patch.shopPhone);
    put(SETTINGS_KEYS.currency, patch.currency);
    put(SETTINGS_KEYS.taxRate, patch.taxRate);
    put(SETTINGS_KEYS.lowStockThreshold, patch.lowStockThreshold);
    put(SETTINGS_KEYS.invoicePrefix, patch.invoicePrefix);
    put(SETTINGS_KEYS.printerStrategy, patch.printerStrategy);
    put(SETTINGS_KEYS.themeMode, patch.themeMode);
    put(SETTINGS_KEYS.onboardingComplete, patch.onboardingComplete);

    if (Object.keys(toWrite).length > 0) {
      await settingsRepository.setMany(toWrite);
    }
  }

  async completeOnboarding(): Promise<void> {
    await settingsRepository.set(SETTINGS_KEYS.onboardingComplete, 'true');
  }

  /** The shop header used on receipts. */
  toShopInfo(settings: AppSettings): ReceiptShopInfo {
    return {
      name: settings.shopName,
      address: settings.shopAddress || undefined,
      phone: settings.shopPhone || undefined,
      currency: settings.currency,
    };
  }
}

export const settingsService = new SettingsService();
