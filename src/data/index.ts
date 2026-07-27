/**
 * Composition root for the data layer.
 *
 * Everything above imports the *interface* type and takes the instance from
 * here. Swapping SQLite for Supabase later is a change to this file plus one
 * new class — no screen or service is touched.
 */

import {
  ICartDraftRepository,
  IInvoiceRepository,
  IProductRepository,
  IReportRepository,
  ISettingsRepository,
  IUserRepository,
} from './repositories/interfaces';
import { SqliteProductRepository } from './repositories/SqliteProductRepository';
import { SqliteInvoiceRepository } from './repositories/SqliteInvoiceRepository';
import { SqliteUserRepository } from './repositories/SqliteUserRepository';
import { SqliteSettingsRepository } from './repositories/SqliteSettingsRepository';
import { SqliteCartDraftRepository } from './repositories/SqliteCartDraftRepository';
import { SqliteReportRepository } from './repositories/SqliteReportRepository';

export const productRepository: IProductRepository = new SqliteProductRepository();
export const invoiceRepository: IInvoiceRepository = new SqliteInvoiceRepository();
export const userRepository: IUserRepository = new SqliteUserRepository();
export const settingsRepository: ISettingsRepository = new SqliteSettingsRepository();
export const cartDraftRepository: ICartDraftRepository = new SqliteCartDraftRepository();
export const reportRepository: IReportRepository = new SqliteReportRepository();

export * from './repositories/interfaces';
export { getDatabase, closeDatabase, resetDatabase } from './database';
export { SqliteProductRepository } from './repositories/SqliteProductRepository';
export { SqliteInvoiceRepository } from './repositories/SqliteInvoiceRepository';
export { SqliteUserRepository } from './repositories/SqliteUserRepository';
export { SqliteSettingsRepository } from './repositories/SqliteSettingsRepository';
