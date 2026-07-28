/**
 * Export and import the whole shop as a single JSON file.
 *
 * Because QuickBill stores everything on one device, the backup file IS the
 * only copy of the shop's history. This module owns the IO — writing, sharing
 * and picking files. The format itself (schema, checksum, validation) lives in
 * `backupFormat.ts`, which is pure and fully unit-tested.
 *
 * The restore runs as one transaction, so it either fully applies or leaves the
 * database exactly as it was.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { BackupTables, dumpAllTables, restoreTables, RestoreOutcome } from '../data/backup';
import { ValidationError, toAppError } from '../errors/AppError';
import { logger } from '../errors/logger';
import { checksumOf } from '../utils/checksum';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFile,
  BackupSummary,
  canonicalise,
  parseBackup,
  summaryOf,
} from './backupFormat';

export { BACKUP_FORMAT, BACKUP_VERSION } from './backupFormat';
export type { BackupFile, BackupSummary } from './backupFormat';

export interface ExportResult {
  uri: string;
  fileName: string;
  shared: boolean;
  shareError?: string;
  summary: BackupSummary;
}

export interface ImportResult {
  outcome: RestoreOutcome;
  summary: BackupSummary;
}

export class BackupService {
  private get appVersion(): string {
    return Constants.expoConfig?.version ?? '1.0.0';
  }

  /** Writes a backup file and offers the share sheet. */
  async exportToFile(options: { shopName?: string } = {}): Promise<ExportResult> {
    const data = await dumpAllTables();

    const payload: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: { name: 'QuickBill', version: this.appVersion },
      shop: options.shopName,
      counts: {
        products: data.products.length,
        invoices: data.invoices.length,
        invoiceItems: data.invoiceItems.length,
        users: data.users.length,
        settings: data.settings.length,
      },
      checksum: checksumOf(canonicalise(data)),
      data,
    };

    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const fileName = `quickbill-backup-${stamp}.json`;

    let file: FileSystem.File;
    try {
      const directory = new FileSystem.Directory(FileSystem.Paths.document, 'backups');
      if (!directory.exists) directory.create({ intermediates: true });

      file = new FileSystem.File(directory, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(JSON.stringify(payload, null, 2));
    } catch (error) {
      logger.error('Could not write the backup file', error);
      throw new ValidationError('Failed to write backup file', {
        userMessage: 'Could not save the backup. Check that the device has free storage.',
      });
    }

    // Sharing is reported honestly rather than assumed — the file exists on the
    // device either way, but "exported" should not claim it left the phone.
    let shared = false;
    let shareError: string | undefined;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save QuickBill backup',
          UTI: 'public.json',
        });
        shared = true;
      } else {
        shareError = 'No app on this device can receive the file.';
      }
    } catch (error) {
      shareError = 'The share sheet could not be opened.';
      logger.warn('Sharing the backup failed', { reason: String(error) });
    }

    const summary = summaryOf(payload);
    logger.info('Backup exported', { fileName, ...payload.counts, shared });

    return { uri: file.uri, fileName, shared, shareError, summary };
  }

  /**
   * Opens the file picker and parses the chosen file.
   * Returns null when the user cancels — cancelling is not an error.
   */
  async pickAndParse(): Promise<{ backup: BackupFile; summary: BackupSummary } | null> {
    let raw: string;

    try {
      const picked = await FileSystem.File.pickFileAsync({
        mimeTypes: ['application/json'],
      });
      if (picked.canceled || !picked.result) return null;
      raw = await picked.result.text();
    } catch (error) {
      logger.error('Could not read the selected backup file', error);
      throw new ValidationError('Unreadable backup file', {
        userMessage: 'That file could not be opened. Try picking it again.',
      });
    }

    const backup = parseBackup(raw);
    return { backup, summary: summaryOf(backup) };
  }

  /** Delegates to the pure validator; kept here as the service's public API. */
  parse(raw: string): BackupFile {
    return parseBackup(raw);
  }

  /** Applies an already-parsed and validated backup. */
  async restore(
    backup: BackupFile,
    mode: 'replace' | 'merge',
    options: { includeUsers: boolean },
  ): Promise<ImportResult> {
    try {
      const outcome = await restoreTables(backup.data as BackupTables, mode, options);
      return { outcome, summary: summaryOf(backup) };
    } catch (error) {
      // restoreTables runs in one transaction, so nothing was written.
      const appError = toAppError(error);
      logger.error('Restore failed and was rolled back', appError, { mode });
      throw appError;
    }
  }
}

export const backupService = new BackupService();
