/** Bill history with search, status filter and reprint (guide §12). */

import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAsyncOnFocus } from '../../hooks/useAsync';
import { invoiceRepository } from '../../../data';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTheme } from '../../hooks/useResponsive';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../../components/common';
import { formatMoney } from '../../../domain/Money';
import { Invoice, PaymentStatus } from '../../../domain/Invoice';
import { formatRelativeDay, formatTime } from '../../../utils/format';
import type { RootStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FILTERS: { id: PaymentStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paid', label: 'Paid' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partial' },
];

export function BillHistoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const currency = useSettingsStore((s) => s.settings.currency);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all');

  const { data, initialLoading, error, reload } = useAsyncOnFocus<Invoice[]>(
    () => invoiceRepository.list({ search: search.trim() || undefined, status, limit: 100 }),
    [search, status],
    { label: 'bills' },
  );

  const invoices = data ?? [];

  const header = (
    <View style={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
      <Field
        value={search}
        onChangeText={setSearch}
        placeholder="Search bill number or customer…"
        icon="search-outline"
        autoCapitalize="none"
        returnKeyType="search"
      />
      <Spacer size={theme.spacing.md} />
      <Row gap={theme.spacing.sm} style={{ flexWrap: 'wrap' }}>
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            title={filter.label}
            size="small"
            variant={status === filter.id ? 'purple' : 'secondary'}
            onPress={() => setStatus(filter.id)}
          />
        ))}
      </Row>
    </View>
  );

  if (initialLoading) {
    return (
      <Screen>
        <LoadingState label="Loading bills…" />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {invoices.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title={search || status !== 'all' ? 'No matching bills' : 'No bills yet'}
          message={
            search || status !== 'all'
              ? 'Try a different search or filter.'
              : 'Completed sales will appear here.'
          }
        />
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={(invoice) => String(invoice.id)}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 110,
            gap: theme.spacing.md,
          }}
          onRefresh={reload}
          refreshing={false}
          renderItem={({ item, index }) => {
            const previous = invoices[index - 1];
            const day = formatRelativeDay(item.createdAt);
            const showDay = !previous || formatRelativeDay(previous.createdAt) !== day;

            return (
              <View>
                {showDay ? (
                  <>
                    <Txt variant="label" color="muted">
                      {day}
                    </Txt>
                    <Spacer size={theme.spacing.sm} />
                  </>
                ) : null}
                <Pressable
                  onPress={() => navigation.navigate('Receipt', { invoiceId: item.id! })}
                  accessibilityRole="button"
                  accessibilityLabel={`Bill ${item.invoiceNo}, ${formatMoney(
                    item.grandTotal,
                    currency,
                  )}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Card variant="surface" radiusSize="xl">
                    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Txt variant="label" style={{ fontSize: 16, fontWeight: '700' }}>{item.invoiceNo}</Txt>
                        <Spacer size={2} />
                        <Txt variant="caption" color="muted">
                          {formatTime(item.createdAt)} · {item.unitCount()} items
                          {item.customerName ? ` · ${item.customerName}` : ''}
                        </Txt>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt variant="heading" style={{ fontSize: 17, fontWeight: '700' }}>{formatMoney(item.grandTotal, currency)}</Txt>
                        <Spacer size={4} />
                        <Badge
                          label={item.paymentStatus}
                          tone={
                            item.paymentStatus === 'paid'
                              ? 'green'
                              : item.paymentStatus === 'refunded'
                                ? 'neutral'
                                : 'warning'
                          }
                        />
                      </View>
                    </Row>
                  </Card>
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}
