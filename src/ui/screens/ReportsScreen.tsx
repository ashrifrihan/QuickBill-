/**
 * Sales reports (guide §8.7). Numbers come from SQL aggregates; the bar chart
 * is drawn with plain Views so there is no chart-library dependency to keep
 * the app free and the bundle small.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useAsyncOnFocus } from '../hooks/useAsync';
import { reportService } from '../../services/ReportService';
import { DailySales, SalesSummary, TopProduct } from '../../data/repositories/interfaces';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../hooks/useResponsive';
import {
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
import { lastNDaysRange, monthToDateRange, todayRange } from '../../utils/format';

type Period = 'today' | 'week' | 'month';

const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: '7 days' },
  { id: 'month', label: 'This month' },
];

function rangeFor(period: Period) {
  if (period === 'today') return todayRange();
  if (period === 'week') return lastNDaysRange(7);
  return monthToDateRange();
}

interface ReportData {
  summary: SalesSummary;
  daily: DailySales[];
  top: TopProduct[];
}

export function ReportsScreen() {
  const theme = useTheme();
  const currency = useSettingsStore((s) => s.settings.currency);
  const [period, setPeriod] = useState<Period>('week');

  const { data, initialLoading, error, reload } = useAsyncOnFocus<ReportData>(
    async () => {
      const range = rangeFor(period);
      const [summary, daily, top] = await Promise.all([
        reportService.summary(range),
        reportService.dailySales(range),
        reportService.topProducts(range, 5),
      ]);
      return { summary, daily, top };
    },
    [period],
    { label: 'reports' },
  );

  if (initialLoading) {
    return (
      <Screen>
        <LoadingState label="Crunching the numbers…" />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Could not load reports.'} onRetry={reload} />
      </Screen>
    );
  }

  const { summary, daily, top } = data;
  const peak = Math.max(1, ...daily.map((d) => d.total));

  return (
    <Screen scroll>
      <Row gap={theme.spacing.sm}>
        {PERIODS.map((p) => (
          <Button
            key={p.id}
            title={p.label}
            size="small"
            variant={period === p.id ? 'primary' : 'secondary'}
            onPress={() => setPeriod(p.id)}
          />
        ))}
      </Row>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="caption" color="muted">
          Total sales
        </Txt>
        <Spacer size={4} />
        <Txt variant="display">{formatMoney(summary.total, currency)}</Txt>
        <Spacer size={theme.spacing.md} />
        <Divider />
        <Spacer size={theme.spacing.md} />
        <Row style={{ justifyContent: 'space-between' }}>
          <Metric label="Bills" value={String(summary.billCount)} />
          <Metric label="Units sold" value={String(summary.unitsSold)} />
          <Metric label="Avg. bill" value={formatMoney(summary.averageBill, currency)} />
        </Row>
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Daily sales</Txt>
        <Spacer size={theme.spacing.lg} />
        {daily.length === 0 ? (
          <Txt color="muted">No sales in this period.</Txt>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 }}>
            {daily.map((day) => (
              <View key={day.date} style={{ flex: 1, alignItems: 'center' }}>
                <Txt variant="caption" color="muted">
                  {day.billCount}
                </Txt>
                <Spacer size={4} />
                <View
                  accessibilityLabel={`${day.date}: ${formatMoney(day.total, currency)}`}
                  style={{
                    width: '100%',
                    // Scaled against the peak day so the chart always fills.
                    height: Math.max(4, (day.total / peak) * 100),
                    backgroundColor: theme.colors.primary,
                    borderRadius: 4,
                  }}
                />
                <Spacer size={4} />
                <Txt variant="caption" color="muted">
                  {day.date.slice(8)}
                </Txt>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Top products</Txt>
        <Spacer size={theme.spacing.md} />
        {top.length === 0 ? (
          <Txt color="muted">Nothing sold in this period.</Txt>
        ) : (
          top.map((product, index) => (
            <View key={product.barcode}>
              {index > 0 ? <Divider /> : null}
              <Row style={{ justifyContent: 'space-between', paddingVertical: 10 }}>
                <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
                  <Txt numberOfLines={1}>
                    {index + 1}. {product.productName}
                  </Txt>
                  <Txt variant="caption" color="muted">
                    {product.unitsSold} sold
                  </Txt>
                </View>
                <Txt variant="label">{formatMoney(product.revenue, currency)}</Txt>
              </Row>
            </View>
          ))
        )}
      </Card>

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Txt variant="label">{value}</Txt>
      <Txt variant="caption" color="muted">
        {label}
      </Txt>
    </View>
  );
}
