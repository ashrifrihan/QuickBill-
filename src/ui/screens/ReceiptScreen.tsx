/**
 * Post-sale screen: print, share, or start the next sale.
 * Also reached from Bill History for a reprint (guide §12).
 *
 * The sale is already committed by the time this renders — nothing here can
 * lose it, and a printer failure is reported as an inconvenience, not an error.
 */

import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { invoiceRepository } from '../../data';
import { useAsync } from '../hooks/useAsync';
import { useCheckout } from '../hooks/useCheckout';
import { useSettingsStore } from '../../store/settingsStore';
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
  const currency = useSettingsStore((s) => s.settings.currency);
  const { print, printing, error, clearError } = useCheckout();

  const [printNote, setPrintNote] = useState<string | null>(null);

  const load = useCallback(() => invoiceRepository.findById(params.invoiceId), [params.invoiceId]);
  const { data: invoice, loading, error: loadError, reload } = useAsync<Invoice | null>(load, [
    params.invoiceId,
  ]);

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

        {invoice.items.map((item) => (
          <Row
            key={`${item.barcode}-${item.id ?? item.productName}`}
            style={{ justifyContent: 'space-between', paddingVertical: 5 }}
          >
            <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
              <Txt numberOfLines={2}>{item.productName}</Txt>
              <Txt variant="caption" color="muted">
                {item.quantity} × {formatMoney(item.unitPrice, currency)}
              </Txt>
            </View>
            <Txt>{formatMoney(item.lineTotal, currency)}</Txt>
          </Row>
        ))}

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

      <Button
        title="Print / share bill"
        size="large"
        onPress={handlePrint}
        loading={printing}
        disabled={printing}
      />
      <Spacer size={theme.spacing.sm} />

      {params.justCreated ? (
        <Button title="Next sale" variant="secondary" onPress={goHome} />
      ) : (
        <Button title="Back" variant="ghost" onPress={() => navigation.goBack()} />
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
