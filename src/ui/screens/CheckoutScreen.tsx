/**
 * Confirm and take payment (guide §12, "Bill Summary").
 *
 * The cart is only cleared once `BillingService.checkout()` has committed, so
 * a failure here leaves the cashier exactly where they were.
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCheckout } from '../hooks/useCheckout';
import { useCartStore } from '../../store/cartStore';
import { useTheme } from '../hooks/useResponsive';
import {
  Button,
  Card,
  Divider,
  ErrorBanner,
  Field,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../components/common';
import { formatMoney, parseMoney } from '../../domain/Money';
import { PaymentMethod } from '../../domain/Invoice';
import { logger } from '../../errors/logger';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'other', label: 'Other' },
];

export function CheckoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const setCustomer = useCartStore((s) => s.setCustomer);

  const { totals, currency, submitting, error, checkout, clearError } = useCheckout();

  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [customerName, setCustomerName] = useState('');
  const [cashGiven, setCashGiven] = useState('');
  const [unpaid, setUnpaid] = useState(false);

  const amountPaid = useMemo(() => {
    if (unpaid) return 0;
    if (method !== 'cash') return totals.grandTotal;
    const parsed = parseMoney(cashGiven);
    // Blank means "exact amount" — the common case, no typing needed.
    return parsed === null ? totals.grandTotal : parsed;
  }, [unpaid, method, cashGiven, totals.grandTotal]);

  const change = Math.max(0, amountPaid - totals.grandTotal);
  const short = Math.max(0, totals.grandTotal - amountPaid);

  const handleConfirm = async () => {
    if (customerName.trim()) setCustomer(customerName.trim());

    const invoice = await checkout({
      paymentMethod: method,
      paymentStatus: unpaid ? 'unpaid' : short > 0 ? 'partial' : 'paid',
      amountPaid,
    });

    // `checkout` returns null only when it already set `error`, which the
    // banner above renders — so there is always visible feedback.
    if (!invoice) return;

    if (invoice.id === undefined) {
      // The sale IS committed at this point. Previously this branch did
      // nothing at all, so the cashier tapped Confirm and the screen just sat
      // there with no way to finish. Send them to the bill list instead of
      // leaving them stranded.
      logger.error('Checkout saved an invoice with no id', undefined, {
        invoiceNo: invoice.invoiceNo,
      });
      navigation.replace('Main', { screen: 'BillsTab', params: { screen: 'BillHistory' } });
      return;
    }

    // `replace` so Back doesn't return to a checkout for an already-sold cart.
    navigation.replace('Receipt', { invoiceId: invoice.id, justCreated: true });
  };

  const line = (label: string, value: string, strong = false) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
      <Txt variant={strong ? 'heading' : 'body'} color={strong ? undefined : 'muted'}>
        {label}
      </Txt>
      <Txt variant={strong ? 'title' : 'body'}>{value}</Txt>
    </Row>
  );

  return (
    <Screen scroll>
      {error ? (
        <>
          <ErrorBanner message={error} onDismiss={clearError} />
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      <Card>
        <Txt variant="heading">Bill summary</Txt>
        <Spacer size={theme.spacing.md} />
        {line('Items', `${totals.unitCount} unit${totals.unitCount === 1 ? '' : 's'}`)}
        {line('Subtotal', formatMoney(totals.subtotal, currency))}
        {totals.discount > 0 ? line('Discount', `−${formatMoney(totals.discount, currency)}`) : null}
        {totals.tax > 0 ? line('Tax', formatMoney(totals.tax, currency)) : null}
        <Spacer size={theme.spacing.sm} />
        <Divider />
        <Spacer size={theme.spacing.sm} />
        {line('Total', formatMoney(totals.grandTotal, currency), true)}
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Payment</Txt>
        <Spacer size={theme.spacing.md} />

        <Row gap={theme.spacing.sm} style={{ flexWrap: 'wrap' }}>
          {METHODS.map((m) => (
            <Button
              key={m.id}
              title={m.label}
              size="small"
              variant={method === m.id ? 'primary' : 'secondary'}
              onPress={() => setMethod(m.id)}
            />
          ))}
        </Row>

        {method === 'cash' && !unpaid ? (
          <>
            <Spacer size={theme.spacing.md} />
            <Field
              label="Cash received"
              value={cashGiven}
              onChangeText={setCashGiven}
              keyboardType="decimal-pad"
              placeholder={`Exact — ${formatMoney(totals.grandTotal, currency)}`}
              hint="Leave blank for the exact amount."
            />
            {change > 0 ? (
              <>
                <Spacer size={theme.spacing.md} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="heading" color="success">
                    Change due
                  </Txt>
                  <Txt variant="title" color="success">
                    {formatMoney(change, currency)}
                  </Txt>
                </Row>
              </>
            ) : null}
            {short > 0 ? (
              <>
                <Spacer size={theme.spacing.md} />
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt variant="heading" color="warning">
                    Short by
                  </Txt>
                  <Txt variant="title" color="warning">
                    {formatMoney(short, currency)}
                  </Txt>
                </Row>
                <Txt variant="caption" color="muted">
                  This will be saved as a partly paid bill.
                </Txt>
              </>
            ) : null}
          </>
        ) : null}

        <Spacer size={theme.spacing.md} />
        <Button
          title={unpaid ? '✓ Marked as unpaid (credit)' : 'Mark as unpaid (credit)'}
          variant={unpaid ? 'primary' : 'ghost'}
          size="small"
          onPress={() => setUnpaid((value) => !value)}
        />
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Field
          label="Customer name (optional)"
          value={customerName}
          onChangeText={setCustomerName}
          placeholder="Walk-in"
        />
      </Card>

      <Spacer size={theme.spacing.xl} />

      <View>
        <Button
          title={`Confirm ${formatMoney(totals.grandTotal, currency)}`}
          size="large"
          onPress={handleConfirm}
          loading={submitting}
          disabled={submitting || totals.itemCount === 0}
        />
        <Spacer size={theme.spacing.sm} />
        <Button
          title="Back to bill"
          variant="ghost"
          onPress={() => navigation.goBack()}
          disabled={submitting}
        />
      </View>
      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}
