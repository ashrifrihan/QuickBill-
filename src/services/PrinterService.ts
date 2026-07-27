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
export class PdfPrintStrategy implements IPrintStrategy {
  readonly id = 'pdf' as const;
  readonly label = 'PDF / Share';

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async print(invoice: Invoice, shop: ReceiptShopInfo): Promise<PrintResult> {
    try {
      const html = buildReceiptHtml(invoice, shop);
      const { uri } = await Print.printToFileAsync({ html, base64: false });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Bill ${invoice.invoiceNo}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        logger.warn('Sharing unavailable; PDF saved only', { uri });
      }

      return { strategy: 'pdf', uri, usedFallback: false };
    } catch (error) {
      throw new PrinterError('Failed to generate or share the PDF receipt', {
        userMessage: 'Could not create the PDF. The sale is still saved.',
        recoverable: false,
        cause: error,
      });
    }
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
