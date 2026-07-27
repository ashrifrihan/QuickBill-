/**
 * Post-sale screen: print, share, or start the next sale.
 * Also reached from Bill History for a reprint (guide §12).
 *
 * The sale is already committed by the time this renders — nothing here can
 * lose it, and a printer failure is reported as an inconvenience, not an error.
 */

import React, { useCallback, useState } from 'react';
import { Image, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { invoiceRepository } from '../../data';
import { useAsync } from '../hooks/useAsync';
import { useCheckout } from '../hooks/useCheckout';
import { useSettingsStore } from '../../store/settingsStore';
import { settingsService } from '../../services/SettingsService';
import { productService } from '../../services/ProductService';
import { PdfPrintStrategy } from '../../services/PrinterService';
import { toAppError } from '../../errors/AppError';
import { useTheme } from '../hooks/useResponsive';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorBanner,
  ErrorState,
  LoadingState,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../components/common';
import { formatMoney } from '../../domain/Money';
import { Invoice } from '../../domain/Invoice';
import { formatDateTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ReceiptRoute = RouteProp<RootStackParamList, 'Receipt'>;

export function ReceiptScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<ReceiptRoute>();
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings.currency;
  const { print, printing, error, clearError } = useCheckout();

  const [printNote, setPrintNote] = useState<string | null>(null);

  /**
   * Loads the bill plus the current photo for each line.
   *
   * Photos are NOT stored on invoice_items — those hold the frozen name and
   * price only (guide §6). The image is decoration, not financial data, so
   * looking up the product's current photo is safe: even if the product was
   * repriced or renamed since, the money on this receipt still comes from the
   * saved invoice.
   */
  const load = useCallback(async () => {
    const found = await invoiceRepository.findById(params.invoiceId);
    if (!found) return { invoice: null, photos: {} as Record<string, string> };

    const barcodes = Array.from(new Set(found.items.map((item) => item.barcode)));
    const photos: Record<string, string> = {};

    // A missing product (deleted since the sale) must not break the receipt.
    await Promise.all(
      barcodes.map(async (barcode) => {
        try {
          const product = await productService.findByBarcode(barcode);
          if (product?.imageUri) photos[barcode] = product.imageUri;
        } catch {
          /* ignore — the receipt renders fine without a thumbnail */
        }
      }),
    );

    return { invoice: found, photos };
  }, [params.invoiceId]);

  const { data, loading, error: loadError, reload } = useAsync(load, [params.invoiceId]);
  const invoice = data?.invoice ?? null;
  const photos = data?.photos ?? {};

  if (loading) return <Screen><LoadingState label="Loading bill…" /></Screen>;
  if (loadError) return <Screen><ErrorState message={loadError} onRetry={reload} /></Screen>;
  if (!invoice) {
    return (
      <Screen>
        <ErrorState message="That bill could not be found." onRetry={reload} />
      </Screen>
    );
  }

  const handlePrint = async () => {
    setPrintNote(null);
    const result = await print(invoice);
    if (result?.usedFallback) {
      setPrintNote('The thermal printer was unavailable, so the bill was shared as a PDF.');
    }
  };

  /**
   * Second output path. If sharing a PDF fails on this device, the OS print
   * dialog can still render it (and Android's "Save as PDF" target writes the
   * file), so the shopkeeper is never left with no way to produce a bill.
   */
  const handleSystemPrint = async () => {
    setPrintNote(null);
    try {
      const shop = settingsService.toShopInfo(settings);
      await new PdfPrintStrategy().printToSystemPrinter(invoice, shop);
    } catch (error) {
      setPrintNote(toAppError(error).userMessage);
    }
  };

  const goHome = () => {
    navigation.navigate('Main', { screen: 'ScanTab' });
  };

  return (
    <Screen scroll>
      {params.justCreated ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <Txt variant="display">✅</Txt>
            <Spacer size={theme.spacing.sm} />
            <Txt variant="title">Sale complete</Txt>
            <Spacer size={theme.spacing.xs} />
            <Txt color="muted">{invoice.invoiceNo}</Txt>
          </View>
          <Spacer size={theme.spacing.xl} />
        </>
      ) : null}

      {error ? (
        <>
          <ErrorBanner message={error} onDismiss={clearError} />
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      {printNote ? (
        <>
          <Card style={{ backgroundColor: theme.colors.surfaceAlt }}>
            <Txt variant="label" color="warning">
              {printNote}
            </Txt>
          </Card>
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="heading">{invoice.invoiceNo}</Txt>
            <Txt variant="caption" color="muted">
              {formatDateTime(invoice.createdAt)}
            </Txt>
          </View>
          <Badge
            label={invoice.paymentStatus}
            tone={
              invoice.paymentStatus === 'paid'
                ? 'success'
                : invoice.paymentStatus === 'refunded'
                  ? 'neutral'
                  : 'warning'
            }
          />
        </Row>

        {invoice.customerName ? (
          <>
            <Spacer size={theme.spacing.sm} />
            <Txt variant="caption" color="muted">
              Customer: {invoice.customerName}
            </Txt>
          </>
        ) : null}

        <Spacer size={theme.spacing.md} />
        <Divider />
        <Spacer size={theme.spacing.md} />

        {invoice.items.map((item) => {
          const photo = photos[item.barcode];
          return (
            <Row
              key={`${item.barcode}-${item.id ?? item.productName}`}
              style={{ justifyContent: 'space-between', paddingVertical: 7 }}
              gap={theme.spacing.md}
            >
              {/* Photo when the product has one, initial tile when it doesn't,
                  so every row keeps the same height and the list stays even. */}
              {photo ? (
                <Image
                  source={{ uri: photo }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surfaceAlt,
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.colors.surfaceAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Txt style={{ fontWeight: '700' }} color="muted">
                    {item.productName.charAt(0).toUpperCase()}
                  </Txt>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Txt numberOfLines={2}>{item.productName}</Txt>
                <Txt variant="caption" color="muted">
                  {item.quantity} × {formatMoney(item.unitPrice, currency)}
                </Txt>
              </View>
              <Txt>{formatMoney(item.lineTotal, currency)}</Txt>
            </Row>
          );
        })}

        <Spacer size={theme.spacing.md} />
        <Divider />
        <Spacer size={theme.spacing.md} />

        <SummaryRow label="Subtotal" value={formatMoney(invoice.subtotal, currency)} />
        {invoice.discount > 0 ? (
          <SummaryRow label="Discount" value={`−${formatMoney(invoice.discount, currency)}`} />
        ) : null}
        {invoice.tax > 0 ? (
          <SummaryRow label="Tax" value={formatMoney(invoice.tax, currency)} />
        ) : null}

        <Spacer size={theme.spacing.sm} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">Total</Txt>
          <Txt variant="title">{formatMoney(invoice.grandTotal, currency)}</Txt>
        </Row>

        {invoice.changeDue() > 0 ? (
          <SummaryRow label="Change given" value={formatMoney(invoice.changeDue(), currency)} />
        ) : null}
        {invoice.balanceDue() > 0 ? (
          <SummaryRow label="Balance due" value={formatMoney(invoice.balanceDue(), currency)} />
        ) : null}
      </Card>

      <Spacer size={theme.spacing.xl} />

      {/*
        One primary action, one secondary, one way out. The previous stack of
        four full-width buttons — two of which both printed — gave no clue
        which one to press.
      */}
      <Button
        title="Send bill to customer"
        icon="share-outline"
        size="large"
        onPress={handlePrint}
        loading={printing}
        disabled={printing}
      />
      <Spacer size={theme.spacing.xs} />
      <Txt variant="caption" color="muted" align="center">
        Creates a PDF you can send on WhatsApp, email or save
      </Txt>

      <Spacer size={theme.spacing.lg} />

      <Button
        title="Print on a paper printer"
        variant="secondary"
        icon="print-outline"
        onPress={handleSystemPrint}
      />

      <Spacer size={theme.spacing.xl} />

      {params.justCreated ? (
        <Button title="Done — start next sale" icon="checkmark-circle-outline" onPress={goHome} />
      ) : (
        <Button title="Start a new sale" variant="ghost" icon="add" onPress={goHome} />
      )}
      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
      <Txt color="muted">{label}</Txt>
      <Txt>{value}</Txt>
    </Row>
  );
}
