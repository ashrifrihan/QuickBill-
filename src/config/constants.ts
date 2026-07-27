/**
 * App-wide constants. Anything configurable at runtime lives in the `settings`
 * table instead — these are compile-time defaults and hard limits.
 */

export const DB_NAME = 'quickbill.db';

/** Width at or above which we switch to the tablet (multi-pane) layout. */
export const TABLET_BREAKPOINT = 768;

/** Minimum comfortable tappable area, in dp. */
export const MIN_TOUCH_TARGET = 44;

/**
 * How long the scanner ignores further reads after a successful one.
 * Cameras fire the same barcode many times per second; this makes one
 * physical scan equal one item.
 */
export const SCAN_DEBOUNCE_MS = 1200;

/** Default stock level at or below which a product is flagged as low. */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** Iterations for the local password hash. See utils/hash.ts. */
export const PASSWORD_HASH_ITERATIONS = 1000;

export const SETTINGS_KEYS = {
  shopName: 'shop_name',
  shopAddress: 'shop_address',
  shopPhone: 'shop_phone',
  currency: 'currency',
  taxRate: 'tax_rate',
  lowStockThreshold: 'low_stock_threshold',
  invoiceSequence: 'invoice_sequence',
  invoicePrefix: 'invoice_prefix',
  printerStrategy: 'printer_strategy',
  themeMode: 'theme_mode',
  onboardingComplete: 'onboarding_complete',
} as const;

export const DEFAULT_SETTINGS: Record<string, string> = {
  [SETTINGS_KEYS.shopName]: 'QuickBill Store',
  [SETTINGS_KEYS.shopAddress]: '',
  [SETTINGS_KEYS.shopPhone]: '',
  [SETTINGS_KEYS.currency]: 'LKR',
  [SETTINGS_KEYS.taxRate]: '0',
  [SETTINGS_KEYS.lowStockThreshold]: String(DEFAULT_LOW_STOCK_THRESHOLD),
  [SETTINGS_KEYS.invoiceSequence]: '0',
  [SETTINGS_KEYS.invoicePrefix]: 'INV',
  [SETTINGS_KEYS.printerStrategy]: 'pdf',
  [SETTINGS_KEYS.themeMode]: 'light',
  [SETTINGS_KEYS.onboardingComplete]: 'false',
};

/** Barcode symbologies worth scanning in a retail shop. */
export const SUPPORTED_BARCODE_TYPES = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code39',
  'code93',
  'code128',
  'itf14',
  'codabar',
  'qr',
] as const;
