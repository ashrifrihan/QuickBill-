/**
 * App settings, loaded once at start so every screen can read shop name,
 * currency and tax rate synchronously (guide §8.8).
 */

import { create } from 'zustand';
import { AppSettings, settingsService } from '../services/SettingsService';
import { printerService } from '../services/PrinterService';
import { ThemeMode } from '../config/theme';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../config/constants';
import { logger } from '../errors/logger';
import { toAppError } from '../errors/AppError';

const FALLBACK: AppSettings = {
  shopName: 'QuickBill Store',
  shopAddress: '',
  shopPhone: '',
  currency: 'LKR',
  taxRate: 0,
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
  invoicePrefix: 'INV',
  printerStrategy: 'pdf',
  themeMode: 'light',
  onboardingComplete: false,
};

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  error: string | null;

  load: () => Promise<void>;
  save: (patch: Partial<AppSettings>) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  completeOnboarding: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: FALLBACK,
  loading: true,
  error: null,

  load: async () => {
    try {
      const settings = await settingsService.load();
      // Keep the printer service's strategy in step with the stored choice.
      printerService.setPreferredStrategy(settings.printerStrategy);
      set({ settings, loading: false, error: null });
    } catch (error) {
      // Fall back to defaults rather than blocking the till from opening.
      logger.error('Could not load settings; using defaults', error);
      set({ settings: FALLBACK, loading: false, error: toAppError(error).userMessage });
    }
  },

  save: async (patch) => {
    const next = { ...get().settings, ...patch };
    // Optimistic: the UI updates immediately, then persists.
    set({ settings: next });
    try {
      await settingsService.save(patch);
      if (patch.printerStrategy) printerService.setPreferredStrategy(patch.printerStrategy);
    } catch (error) {
      logger.error('Could not save settings', error);
      set({ error: toAppError(error).userMessage });
      await get().load(); // resync with what actually persisted
      throw error;
    }
  },

  setThemeMode: async (mode) => {
    await get().save({ themeMode: mode });
  },

  completeOnboarding: async () => {
    await get().save({ onboardingComplete: true });
  },
}));

export function useCurrency(): string {
  return useSettingsStore((state) => state.settings.currency);
}
