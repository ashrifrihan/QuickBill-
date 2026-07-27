/** Home: today at a glance with Bento Box & Soft Pastel UI aesthetics (guide §12). */

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
  BentoCard,
  Button,
  Card,
  Divider,
  ErrorState,
  HeaderBar,
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
  const userName = user ? user.name.split(' ')[0] : 'Cashier';
  const avatarInitials = userName.substring(0, 2).toUpperCase();

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <Screen scroll>
      {/* Profile Header (Matching uploaded design style with vector icons) */}
      <HeaderBar
        title={`Hello, ${userName}`}
        subtitle={`${settings.shopName} · Today ${todayDateStr}`}
        avatarText={avatarInitials}
        actionIcon="analytics-outline"
        onActionPress={() => navigation.navigate('Main', { screen: 'HomeTab', params: { screen: 'Reports' } })}
      />

      {/* Hero Bento Banner */}
      {cartTotals.itemCount > 0 ? (
        <BentoCard
          title="Sale in progress"
          subtitle={`${cartTotals.unitCount} item${cartTotals.unitCount === 1 ? '' : 's'} in cart · tap to review`}
          tagLabel="ACTIVE TILL"
          tagTone="yellow"
          variant="yellow"
          icon="cart-outline"
          onPress={() => navigation.navigate('Cart')}
        >
          <Row style={{ justifyContent: 'space-between', marginTop: theme.spacing.sm }}>
            <Txt variant="display" style={{ color: theme.colors.pastelYellowText, fontSize: 26 }}>
              {formatMoney(cartTotals.grandTotal, currency)}
            </Txt>
            <Button
              title="Checkout →"
              variant="primary"
              size="small"
              onPress={() => navigation.navigate('Cart')}
            />
          </Row>
        </BentoCard>
      ) : (
        <BentoCard
          title="Daily challenge"
          subtitle="Do your sales goal before end of shift. Tap to start."
          tagLabel="TODAY'S PLAN"
          tagTone="purple"
          variant="purple"
          icon="flash-outline"
          onPress={() => navigation.navigate('Main', { screen: 'ScanTab' })}
        >
          <Spacer size={theme.spacing.xs} />
          <Row style={{ justifyContent: 'space-between', marginTop: theme.spacing.xs }}>
            <Txt variant="heading" style={{ color: theme.colors.pastelPurpleText, fontSize: 16 }}>
              Ready for next customer
            </Txt>
            <Button
              title="Start Sale →"
              variant="primary"
              size="small"
              onPress={() => navigation.navigate('Main', { screen: 'ScanTab' })}
            />
          </Row>
        </BentoCard>
      )}

      <Spacer size={theme.spacing.lg} />

      {/* Section Header */}
      <Txt variant="heading" style={{ fontSize: 19, fontWeight: '700' }}>
        Today's Overview
      </Txt>
      <Spacer size={theme.spacing.md} />

      {/* Bento Grid Metrics Cards (Matching soft pastel pills in uploaded design) */}
      <Row gap={theme.spacing.md} style={{ flexWrap: isTablet ? 'nowrap' : 'wrap' }}>
        {/* Today's sales card */}
        <View style={{ flex: 1, minWidth: 150 }}>
          <BentoCard
            title={formatMoney(dashboard.today.total, currency)}
            subtitle={`${dashboard.today.billCount} bill${dashboard.today.billCount === 1 ? '' : 's'}`}
            tagLabel="TODAY'S SALES"
            tagTone="green"
            variant="green"
          />
        </View>

        {/* Weekly sales card */}
        <View style={{ flex: 1, minWidth: 150 }}>
          <BentoCard
            title={formatMoney(dashboard.week.total, currency)}
            subtitle={`${dashboard.week.billCount} total bills`}
            tagLabel="THIS WEEK"
            tagTone="blue"
            variant="blue"
          />
        </View>
      </Row>

      <Spacer size={theme.spacing.md} />

      <Row gap={theme.spacing.md} style={{ flexWrap: isTablet ? 'nowrap' : 'wrap' }}>
        {/* Average Bill */}
        <View style={{ flex: 1, minWidth: 150 }}>
          <BentoCard
            title={formatMoney(dashboard.today.averageBill, currency)}
            subtitle={`${dashboard.today.unitsSold} units sold`}
            tagLabel="AVG. BILL"
            tagTone="yellow"
            variant="yellow"
          />
        </View>

        {/* Low Stock Warning */}
        <View style={{ flex: 1, minWidth: 150 }}>
          <BentoCard
            title={`${dashboard.lowStock.length} items`}
            subtitle={dashboard.lowStock.length > 0 ? 'needs restocking' : 'all items in stock'}
            tagLabel="LOW STOCK"
            tagTone={dashboard.lowStock.length > 0 ? 'pink' : 'green'}
            variant={dashboard.lowStock.length > 0 ? 'pink' : 'green'}
          />
        </View>
      </Row>

      <Spacer size={theme.spacing.xl} />

      {/* Primary Floating Action Button */}
      <Button
        title="Start a new sale"
        icon="scan-outline"
        size="large"
        variant="primary"
        onPress={() => navigation.navigate('Main', { screen: 'ScanTab' })}
      />

      <Spacer size={theme.spacing.xl} />

      {/* Running Low Products Card */}
      {dashboard.lowStock.length > 0 ? (
        <>
          <Card variant="surface" radiusSize="xl">
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Txt variant="heading">Running Low</Txt>
                <Txt variant="caption" color="muted">
                  Items requiring inventory replenishment
                </Txt>
              </View>
              <Badge label={`${dashboard.lowStock.length} items`} tone="danger" />
            </Row>
            <Spacer size={theme.spacing.md} />
            {dashboard.lowStock.slice(0, 4).map((product, index) => (
              <View key={product.id}>
                {index > 0 ? <Divider /> : null}
                <Row style={{ justifyContent: 'space-between', paddingVertical: 10 }}>
                  <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
                    <Txt variant="label" numberOfLines={1}>
                      {product.name}
                    </Txt>
                    <Txt variant="caption" color="muted">
                      Barcode: {product.barcode}
                    </Txt>
                  </View>
                  <Badge
                    label={`${product.stockQty} left`}
                    tone={product.isOutOfStock() ? 'danger' : 'warning'}
                  />
                </Row>
              </View>
            ))}
            <Spacer size={theme.spacing.md} />
            <Button
              title="View inventory list →"
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

      {/* Recent Bills Card */}
      <Card variant="surface" radiusSize="xl">
        <Row style={{ justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
          <View>
            <Txt variant="heading">Recent Bills</Txt>
            <Txt variant="caption" color="muted">
              Latest transactions
            </Txt>
          </View>
          <Badge label={`${recent.length} recent`} tone="primary" />
        </Row>
        {recent.length === 0 ? (
          <Txt color="muted">No sales recorded yet today.</Txt>
        ) : (
          recent.map((invoice, index) => (
            <View key={invoice.id}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                onPress={() =>
                  navigation.navigate('Receipt', { invoiceId: invoice.id! })
                }
                accessibilityRole="button"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 12 })}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View>
                    <Txt variant="label" style={{ fontSize: 15, fontWeight: '700' }}>
                      {invoice.invoiceNo}
                    </Txt>
                    <Txt variant="caption" color="muted">
                      {formatTime(invoice.createdAt)} · {invoice.unitCount()} item{invoice.unitCount() === 1 ? '' : 's'}
                    </Txt>
                  </View>
                  <Txt variant="heading" style={{ color: theme.colors.text, fontSize: 16 }}>
                    {formatMoney(invoice.grandTotal, currency)}
                  </Txt>
                </Row>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Spacer size={theme.spacing.xxl} />
    </Screen>
  );
}
