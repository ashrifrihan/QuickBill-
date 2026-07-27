/**
 * Printing, behind a Strategy (guide §8.6).
 *
 * Callers only ever say `printerService.print(invoice)`. Which physical path
 * that takes — PDF share sheet or Bluetooth thermal printer — is a setting.
 *
 * Bluetooth is unreliable by nature, so a failing strategy never dead-ends:
 * the service falls back to PDF and reports which path actually ran.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Invoice } from '../domain/Invoice';
import { PrinterError } from '../errors/AppError';
import { logger } from '../errors/logger';
import { ReceiptShopInfo, buildReceiptHtml, buildReceiptText } from './receiptTemplate';

export type PrinterStrategyId = 'pdf' | 'bluetooth';

export interface PrintResult {
  strategy: PrinterStrategyId;
  /** File path, when the strategy produced one. */
  uri?: string;
  /** True when the requested strategy failed and PDF handled it instead. */
  usedFallback: boolean;
  /**
   * True only when the bill actually reached the customer — the share sheet
   * opened, or bytes went to a printer. False means the file exists but
   * nothing was handed over, which the UI must say out loud rather than
   * silently reporting success.
   */
  shared: boolean;
  /** Why `shared` is false, when it is worth telling the user. */
  shareError?: string;
}

export interface IPrintStrategy {
  readonly id: PrinterStrategyId;
  readonly label: string;
  /** Cheap check so the UI can warn before the user commits to a sale. */
  isAvailable(): Promise<boolean>;
  print(invoice: Invoice, shop: ReceiptShopInfo): Promise<PrintResult>;
}

/**
 * Renders the receipt to a PDF and opens the share sheet (WhatsApp, email,
 * save to files). Needs no hardware, so it is the default and the fallback.
 */
/**
 * Turns a raw expo-print failure into something the shopkeeper can act on.
 *
 * The most common cause in development is a development build that was
 * compiled BEFORE expo-print was added — the JS calls a native module that
 * isn't in the binary. Telling the user to rebuild is far more useful than
 * "something went wrong".
 */
function pdfFailureMessage(error: unknown): string {
  const text = String((error as { message?: string })?.message ?? error);

  if (/cannot find native module|native module.*not.*found|ExpoPrint/i.test(text)) {
    return 'PDF printing is missing from this build. Rebuild the development build so it includes expo-print.';
  }
  if (/permission/i.test(text)) {
    return 'QuickBill needs storage access to save the PDF.';
  }
  if (/space|ENOSPC/i.test(text)) {
    return 'Not enough storage space to create the PDF.';
  }
  // Surface the real reason in development so bugs aren't hidden behind a
  // friendly string; keep it calm in production.
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  return isDev
    ? `Could not create the PDF: ${text}`
    : 'Could not create the PDF. The sale is still saved.';
}

/**
 * Writes the PDF bytes into a directory this app owns, and returns that URI.
 *
 * expo-print saves to `<cache>/Print/<uuid>.pdf`, which sits outside the
 * scoped sandbox that expo-sharing and expo-file-system are permitted to read
 * — sharing it directly fails with "Not allowed to read file under given URL".
 * Copying is not an option either, because the copy would have to READ that
 * same forbidden path. Writing the base64 we already hold sidesteps both.
 *
 * Also gives the attachment a meaningful name instead of a UUID.
 */
async function writeToOwnStorage(base64: string, invoiceNo: string): Promise<string> {
  const directory = new FileSystem.Directory(FileSystem.Paths.document, 'bills');
  if (!directory.exists) directory.create({ intermediates: true });

  const safeName = `Bill-${invoiceNo.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`;
  const file = new FileSystem.File(directory, safeName);

  // Overwrite any earlier copy of the same bill rather than accumulating files.
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: 'base64' });

  return file.uri;
}

export class PdfPrintStrategy implements IPrintStrategy {
  readonly id = 'pdf' as const;
  readonly label = 'PDF / Share';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async print(invoice: Invoice, shop: ReceiptShopInfo): Promise<PrintResult> {
    // Generating the PDF and sharing it are SEPARATE failures with separate
    // meanings. Lumping them together made a dismissed share sheet report
    // "Could not create the PDF" even though the file was written fine.
    let uri: string;

    try {
      const html = buildReceiptHtml(invoice, shop);
      // `base64: true` matters. expo-print writes its file to a cache path that
      // belongs to expo-print, NOT to this app's scoped sandbox — expo-sharing
      // and expo-file-system both refuse to read it ("Not allowed to read file
      // under given URL"). Taking the bytes back through JS lets us re-write
      // the PDF into a directory we do own, which is shareable.
      const result = await Print.printToFileAsync({ html, base64: true });
      uri = result.base64
        ? await writeToOwnStorage(result.base64, invoice.invoiceNo)
        : result.uri;
    } catch (error) {
      throw new PrinterError('Failed to render the receipt to PDF', {
        userMessage: pdfFailureMessage(error),
        recoverable: false,
        cause: error,
      });
    }

    // The generated file is shared as-is. An earlier version copied it to a
    // prettier filename, but expo-file-system's scoped API rejects reads
    // outside the app's own sandbox — and a cosmetic name is not worth an
    // entire extra failure mode on the one action that produces the bill.
    // Whether the share sheet actually opened is reported back, NOT swallowed.
    // Both branches below used to log and then return success, so if sharing
    // was unavailable the button simply appeared to do nothing.
    let shared = false;
    let shareError: string | undefined;

    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Bill ${invoice.invoiceNo}`,
          UTI: 'com.adobe.pdf',
        });
        shared = true;
      } else {
        shareError = 'No app on this device can receive a PDF.';
        logger.warn('Sharing unavailable; PDF saved to disk only', { uri });
      }
    } catch (error) {
      // The PDF exists either way, so this is never fatal — but it is also not
      // success, and the caller needs to be able to tell the user.
      shareError = 'The share sheet could not be opened.';
      logger.warn('Sharing the receipt failed', { uri, reason: String(error) });
    }

    return { strategy: 'pdf', uri, shared, shareError, usedFallback: false };
  }

  /** Opens the OS print dialog for a paper (non-thermal) printer. */
  async printToSystemPrinter(invoice: Invoice, shop: ReceiptShopInfo): Promise<void> {
    try {
      await Print.printAsync({ html: buildReceiptHtml(invoice, shop) });
    } catch (error) {
      throw new PrinterError('System print dialog failed', { cause: error });
    }
  }
}

/**
 * Bluetooth ESC/POS thermal printing.
 *
 * Phase 2 (guide §13). The receipt text is already generated here, but sending
 * bytes over Bluetooth needs a native module
 * (`react-native-bluetooth-escpos-printer` or similar) that requires a
 * development build. `isAvailable()` returns false until that module is wired
 * into `connect`/`sendText` below, so PrinterService transparently falls back
 * to PDF and the cashier is never stranded.
 */
export class BluetoothPrintStrategy implements IPrintStrategy {
  readonly id = 'bluetooth' as const;
  readonly label = 'Bluetooth thermal printer';

  private connectedAddress: string | null = null;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async connect(address: string): Promise<void> {
    throw new PrinterError(`Bluetooth printing is not wired up yet (address ${address})`, {
      userMessage: 'Bluetooth printing is not set up yet. Use PDF for now.',
      recoverable: true,
    });
  }

  async disconnect(): Promise<void> {
    this.connectedAddress = null;
  }

  isConnected(): boolean {
    return this.connectedAddress !== null;
  }

  async print(invoice: Invoice, shop: ReceiptShopInfo): Promise<PrintResult> {
    // The formatted text is ready; only the transport is missing.
    const receipt = buildReceiptText(invoice, shop);
    logger.debug('Thermal receipt prepared', { lines: receipt.split('\n').length });

    throw new PrinterError('Bluetooth printer transport not implemented', {
      userMessage: 'No thermal printer connected. Sharing as PDF instead.',
      recoverable: true,
    });
  }
}

export class PrinterService {
  private readonly strategies: Record<PrinterStrategyId, IPrintStrategy>;
  private preferred: PrinterStrategyId = 'pdf';

  constructor(
    pdf: PdfPrintStrategy = new PdfPrintStrategy(),
    bluetooth: BluetoothPrintStrategy = new BluetoothPrintStrategy(),
  ) {
    this.strategies = { pdf, bluetooth };
  }

  setPreferredStrategy(id: PrinterStrategyId): void {
    this.preferred = id;
  }

  getPreferredStrategy(): PrinterStrategyId {
    return this.preferred;
  }

  getStrategy(id: PrinterStrategyId): IPrintStrategy {
    return this.strategies[id];
  }

  listStrategies(): IPrintStrategy[] {
    return Object.values(this.strategies);
  }

  /**
   * Prints via the preferred strategy, falling back to PDF if it fails
   * recoverably. Throws only when there is genuinely no way to output.
   */
  async print(
    invoice: Invoice,
    shop: ReceiptShopInfo,
    strategyId?: PrinterStrategyId,
  ): Promise<PrintResult> {
    const requested = strategyId ?? this.preferred;
    const strategy = this.strategies[requested] ?? this.strategies.pdf;

    try {
      if (await strategy.isAvailable()) {
        return await strategy.print(invoice, shop);
      }
      logger.info(`Printer strategy "${requested}" unavailable`, { invoiceNo: invoice.invoiceNo });
    } catch (error) {
      const printerError =
        error instanceof PrinterError ? error : new PrinterError(String(error), { cause: error });
      if (!printerError.recoverable) throw printerError;
      logger.warn(`Printer strategy "${requested}" failed; falling back to PDF`, {
        reason: printerError.message,
      });
    }

    if (requested === 'pdf') {
      // PDF was the request and it did not succeed — nothing left to try.
      throw new PrinterError('PDF output failed', {
        userMessage: 'Could not produce the bill. The sale is saved — try again from Bill History.',
        recoverable: false,
      });
    }

    const result = await this.strategies.pdf.print(invoice, shop);
    return { ...result, usedFallback: true };
  }
}

export const printerService = new PrinterService();
