/**
 * The live bill (guide §12).
 *
 * Every figure shown here comes from `Cart.totals()` — the screen does no
 * arithmetic of its own, which is what guarantees it agrees with the invoice
 * and the printed receipt.
 *
 * On a tablet it splits into two panes: the item list on the left, the running
 * total on the right (guide §7) — rearranged, not just stretched.
 */

import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCartStore } from '../../store/cartStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useResponsive, useTheme } from '../hooks/useResponsive';
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  QtyStepper,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../components/common';
import { formatMoney, parseMoney } from '../../domain/Money';
import { CartItem } from '../../domain/CartItem';
import { CartTotals, Discount, LineTotals } from '../../domain/Cart';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CartScreen() {
  const theme = useTheme();
  const { isTwoPane } = useResponsive();
  const navigation = useNavigation<Nav>();

  const cart = useCartStore((s) => s.cart);
  const increaseQty = useCartStore((s) => s.increaseQty);
  const decreaseQty = useCartStore((s) => s.decreaseQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const applyDiscount = useCartStore((s) => s.applyDiscount);
  const clear = useCartStore((s) => s.clear);
  const currency = useSettingsStore((s) => s.settings.currency);

  const totals = cart.totals();

  if (cart.isEmpty) {
    return (
      <Screen>
        <EmptyState
          icon="🛒"
          title="The bill is empty"
          message="Scan a barcode or pick a product to start a sale."
          actionLabel="Start scanning"
          onAction={() => navigation.navigate('Main', { screen: 'ScanTab' })}
        />
      </Screen>
    );
  }

  const itemList = (
    <FlatList
      data={totals.lines}
      keyExtractor={(line) => line.item.barcode}
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      ItemSeparatorComponent={() => <Spacer size={theme.spacing.sm} />}
      renderItem={({ item: line }) => (
        <CartLine
          line={line}
          currency={currency}
          onIncrease={() => increaseQty(line.item.barcode)}
          onDecrease={() => decreaseQty(line.item.barcode)}
          onRemove={() => removeItem(line.item.barcode)}
        />
      )}
    />
  );

  const summary = (
    <SummaryPane
      totals={totals}
      currency={currency}
      discountType={cart.discount.type}
      discountValue={cart.discount.value}
      onApplyDiscount={applyDiscount}
      onClear={clear}
      onCheckout={() => navigation.navigate('Checkout')}
    />
  );

  if (isTwoPane) {
    return (
      <Screen>
        <Row style={{ flex: 1, alignItems: 'stretch' }}>
          <View style={{ flex: 3 }}>{itemList}</View>
          <View
            style={{
              flex: 2,
              maxWidth: 420,
              borderLeftWidth: 1,
              borderLeftColor: theme.colors.border,
            }}
          >
            {summary}
          </View>
        </Row>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1 }}>{itemList}</View>
      <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border }}>{summary}</View>
    </Screen>
  );
}

function CartLine({
  line,
  currency,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  line: LineTotals;
  currency: string;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const item: CartItem = line.item;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
          <Txt variant="label" numberOfLines={2}>
            {item.name}
          </Txt>
          <Spacer size={2} />
          <Txt variant="caption" color="muted">
            {formatMoney(item.unitPrice, currency)} each
            {item.taxRate > 0 ? ` · +${Math.round(item.taxRate * 100)}% tax` : ''}
          </Txt>
          {item.exceedsStock() ? (
            <>
              <Spacer size={theme.spacing.xs} />
              {/* A warning, not a block — see BillingService.allowOverSell. */}
              <Badge label={`Only ${item.availableStock} in stock`} tone="warning" />
            </>
          ) : null}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Txt variant="heading">{formatMoney(line.lineTotal, currency)}</Txt>
          {line.discountShare > 0 ? (
            <Txt variant="caption" color="success">
              −{formatMoney(line.discountShare, currency)}
            </Txt>
          ) : null}
        </View>
      </Row>

      <Spacer size={theme.spacing.md} />
      <Divider />
      <Spacer size={theme.spacing.md} />

      <Row style={{ justifyContent: 'space-between' }}>
        <QtyStepper quantity={item.quantity} onIncrease={onIncrease} onDecrease={onDecrease} />
        <Button title="Remove" variant="ghost" size="small" onPress={onRemove} />
      </Row>
    </Card>
  );
}

function SummaryPane({
  totals,
  currency,
  discountType,
  discountValue,
  onApplyDiscount,
  onClear,
  onCheckout,
}: {
  totals: CartTotals;
  currency: string;
  discountType: 'none' | 'amount' | 'percent';
  discountValue: number;
  onApplyDiscount: (discount: Discount) => void;
  onClear: () => void;
  onCheckout: () => void;
}) {
  const theme = useTheme();
  const [showDiscount, setShowDiscount] = useState(discountType !== 'none');
  const [mode, setMode] = useState<'percent' | 'amount'>(
    discountType === 'amount' ? 'amount' : 'percent',
  );
  const [raw, setRaw] = useState(
    discountType === 'percent'
      ? String(discountValue)
      : discountType === 'amount'
        ? String(discountValue / 100)
        : '',
  );
  const [error, setError] = useState<string | null>(null);

  const applyDiscount = (text: string, nextMode: 'percent' | 'amount') => {
    setRaw(text);
    setError(null);

    if (text.trim() === '') {
      onApplyDiscount({ type: 'none', value: 0 });
      return;
    }

    if (nextMode === 'percent') {
      const percent = Number(text);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        setError('Enter 0–100%.');
        return;
      }
      onApplyDiscount({ type: 'percent', value: percent });
    } else {
      const amount = parseMoney(text);
      if (amount === null || amount < 0) {
        setError('Enter a valid amount.');
        return;
      }
      onApplyDiscount({ type: 'amount', value: amount });
    }
  };

  const line = (label: string, value: string, strong = false, tone?: 'success') => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
      <Txt variant={strong ? 'heading' : 'body'} color={strong ? undefined : 'muted'}>
        {label}
      </Txt>
      <Txt variant={strong ? 'title' : 'body'} color={tone}>
        {value}
      </Txt>
    </Row>
  );

  return (
    <View style={{ padding: theme.spacing.lg }}>
      {line('Subtotal', formatMoney(totals.subtotal, currency))}
      {totals.discount > 0
        ? line('Discount', `−${formatMoney(totals.discount, currency)}`, false, 'success')
        : null}
      {totals.tax > 0 ? line('Tax', formatMoney(totals.tax, currency)) : null}

      <Spacer size={theme.spacing.sm} />
      <Divider />
      <Spacer size={theme.spacing.sm} />

      {line('Total', formatMoney(totals.grandTotal, currency), true)}

      <Spacer size={theme.spacing.md} />

      {showDiscount ? (
        <Card style={{ backgroundColor: theme.colors.surfaceAlt }}>
          <Row gap={theme.spacing.sm}>
            <Button
              title="%"
              size="small"
              variant={mode === 'percent' ? 'primary' : 'secondary'}
              onPress={() => {
                setMode('percent');
                applyDiscount(raw, 'percent');
              }}
            />
            <Button
              title={currency}
              size="small"
              variant={mode === 'amount' ? 'primary' : 'secondary'}
              onPress={() => {
                setMode('amount');
                applyDiscount(raw, 'amount');
              }}
            />
            <View style={{ flex: 1 }}>
              <Field
                value={raw}
                onChangeText={(text) => applyDiscount(text, mode)}
                keyboardType="decimal-pad"
                placeholder={mode === 'percent' ? '10' : '100.00'}
                error={error ?? undefined}
              />
            </View>
          </Row>
        </Card>
      ) : (
        <Button title="Add discount" variant="ghost" size="small" onPress={() => setShowDiscount(true)} />
      )}

      <Spacer size={theme.spacing.md} />

      <Button title="Charge" size="large" onPress={onCheckout} />
      <Spacer size={theme.spacing.sm} />
      <Button title="Clear bill" variant="ghost" size="small" onPress={onClear} />
    </View>
  );
}
