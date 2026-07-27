/** Home: today at a glance (guide §12). */

import React from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAsyncOnFocus } from '../hooks/useAsync';
import { reportService, DashboardData } from '../../services/ReportService';
import { invoiceRepository } from '../../data';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useCartTotals } from '../../store/cartStore';
import { useResponsive, useTheme } from '../hooks/useResponsive';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  LoadingState,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../components/common';
import { formatMoney } from '../../domain/Money';
import { Invoice } from '../../domain/Invoice';
import { formatTime } from '../../utils/format';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface HomeData {
  dashboard: DashboardData;
  recent: Invoice[];
}

export function DashboardScreen() {
  const theme = useTheme();
  const { isTablet } = useResponsive();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore((s) => s.settings);
  const cartTotals = useCartTotals();

  const { data, initialLoading, error, reload } = useAsyncOnFocus<HomeData>(
    async () => {
      const [dashboard, recent] = await Promise.all([
        reportService.dashboard(),
        invoiceRepository.list({ limit: 5 }),
      ]);
      return { dashboard, recent };
    },
    [],
    { label: 'dashboard' },
  );

  if (initialLoading) {
    return (
      <Screen>
        <LoadingState label="Loading today's figures…" />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Could not load the dashboard.'} onRetry={reload} />
      </Screen>
    );
  }

  const { dashboard, recent } = data;
  const currency = settings.currency;

  return (
    <Screen scroll>
      <Txt variant="caption" color="muted">
        {settings.shopName}
      </Txt>
      <Txt variant="title">Hello{user ? `, ${user.name.split(' ')[0]}` : ''} 👋</Txt>

      <Spacer size={theme.spacing.lg} />

      {/* An unfinished sale is the most urgent thing on this screen. */}
      {cartTotals.itemCount > 0 ? (
        <>
          <Pressable onPress={() => navigation.navigate('Cart')} accessibilityRole="button">
            <Card style={{ backgroundColor: theme.colors.primary }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Txt variant="label" style={{ color: theme.colors.primaryText }}>
                    Sale in progress
                  </Txt>
                  <Txt variant="caption" style={{ color: theme.colors.primaryText, opacity: 0.85 }}>
                    {cartTotals.unitCount} item{cartTotals.unitCount === 1 ? '' : 's'} · tap to
                    continue
                  </Txt>
                </View>
                <Txt variant="heading" style={{ color: theme.colors.primaryText }}>
                  {formatMoney(cartTotals.grandTotal, currency)}
                </Txt>
              </Row>
            </Card>
          </Pressable>
          <Spacer size={theme.spacing.lg} />
        </>
      ) : null}

      <Row gap={theme.spacing.md} style={{ flexWrap: isTablet ? 'nowrap' : 'wrap' }}>
        <Stat
          label="Today's sales"
          value={formatMoney(dashboard.today.total, currency)}
          hint={`${dashboard.today.billCount} bill${dashboard.today.billCount === 1 ? '' : 's'}`}
        />
        <Stat
          label="This week"
          value={formatMoney(dashboard.week.total, currency)}
          hint={`${dashboard.week.billCount} bills`}
        />
      </Row>

      <Spacer size={theme.spacing.md} />

      <Row gap={theme.spacing.md}>
        <Stat
          label="Avg. bill today"
          value={formatMoney(dashboard.today.averageBill, currency)}
          hint={`${dashboard.today.unitsSold} units sold`}
        />
        <Stat
          label="Low stock"
          value={String(dashboard.lowStock.length)}
          hint={dashboard.lowStock.length > 0 ? 'needs restocking' : 'all good'}
          tone={dashboard.lowStock.length > 0 ? 'warning' : 'success'}
        />
      </Row>

      <Spacer size={theme.spacing.xl} />

      <Button
        title="Start a new sale"
        size="large"
        onPress={() => navigation.navigate('Main', { screen: 'ScanTab' })}
      />

      <Spacer size={theme.spacing.xl} />

      {dashboard.lowStock.length > 0 ? (
        <>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="heading">Running low</Txt>
              <Badge label={`${dashboard.lowStock.length}`} tone="warning" />
            </Row>
            <Spacer size={theme.spacing.md} />
            {dashboard.lowStock.slice(0, 5).map((product) => (
              <Row key={product.id} style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
                <Txt numberOfLines={1} style={{ flex: 1 }}>
                  {product.name}
                </Txt>
                <Txt color={product.isOutOfStock() ? 'danger' : 'warning'}>
                  {product.stockQty} left
                </Txt>
              </Row>
            ))}
            <Spacer size={theme.spacing.md} />
            <Button
              title="View all"
              variant="ghost"
              size="small"
              onPress={() =>
                navigation.navigate('Main', {
                  screen: 'ProductsTab',
                  params: { screen: 'ProductList', params: { lowStockOnly: true } },
                })
              }
            />
          </Card>
          <Spacer size={theme.spacing.lg} />
        </>
      ) : null}

      <Card>
        <Txt variant="heading">Recent bills</Txt>
        <Spacer size={theme.spacing.md} />
        {recent.length === 0 ? (
          <Txt color="muted">No sales yet today.</Txt>
        ) : (
          recent.map((invoice, index) => (
            <View key={invoice.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onPress={() =>
                  navigation.navigate('Receipt', { invoiceId: invoice.id! })
                }
                accessibilityRole="button"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 10 })}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Txt variant="label">{invoice.invoiceNo}</Txt>
                    <Txt variant="caption" color="muted">
                      {formatTime(invoice.createdAt)} · {invoice.unitCount()} items
                    </Txt>
                  </View>
                  <Txt variant="label">{formatMoney(invoice.grandTotal, currency)}</Txt>
                </Row>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'success' | 'warning';
}) {
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Txt variant="caption" color="muted">
        {label}
      </Txt>
      <Spacer size={4} />
      <Txt variant="title" color={tone}>
        {value}
      </Txt>
      {hint ? (
        <>
          <Spacer size={2} />
          <Txt variant="caption" color="muted">
            {hint}
          </Txt>
        </>
      ) : null}
    </Card>
  );
}
