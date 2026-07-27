/** Product catalogue with search and a low-stock badge (guide §12). */

import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProducts } from '../../hooks/useProducts';
import { useSettingsStore } from '../../../store/settingsStore';
import { useIsAdmin } from '../../../store/authStore';
import { useResponsive, useTheme } from '../../hooks/useResponsive';
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
import { Product } from '../../../domain/Product';
import type { ProductsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<ProductsStackParamList>;
type ListRoute = RouteProp<ProductsStackParamList, 'ProductList'>;

export function ProductListScreen() {
  const theme = useTheme();
  const { columns } = useResponsive();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<ListRoute>();
  const isAdmin = useIsAdmin();
  const currency = useSettingsStore((s) => s.settings.currency);

  const {
    products,
    search,
    setSearch,
    initialLoading,
    error,
    reload,
    isEmpty,
    lowStockThreshold,
  } = useProducts({ onlyLowStock: params?.lowStockOnly });

  const header = (
    <View style={{ padding: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
      <Field
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or barcode…"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {params?.lowStockOnly ? (
        <>
          <Spacer size={theme.spacing.sm} />
          <Badge label={`Showing stock at or below ${lowStockThreshold}`} tone="warning" />
        </>
      ) : null}
    </View>
  );

  if (initialLoading) {
    return (
      <Screen>
        <LoadingState label="Loading products…" />
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

      {isEmpty ? (
        <EmptyState
          icon="📦"
          title={search ? 'No matches' : 'No products yet'}
          message={
            search
              ? 'Try a different name or barcode.'
              : 'Add your first product, or just scan an unknown barcode and QuickBill will offer to add it.'
          }
          actionLabel={isAdmin && !search ? 'Add a product' : undefined}
          onAction={isAdmin && !search ? () => navigation.navigate('ProductForm') : undefined}
        />
      ) : (
        <FlatList
          data={products}
          // A remount is required when the column count changes on rotation.
          key={`cols-${columns}`}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: theme.spacing.md } : undefined}
          keyExtractor={(product) => String(product.id)}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl,
            gap: theme.spacing.md,
          }}
          onRefresh={reload}
          refreshing={false}
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              currency={currency}
              lowStockThreshold={lowStockThreshold}
              flex={columns > 1}
              onPress={() => navigation.navigate('ProductDetail', { productId: item.id! })}
            />
          )}
        />
      )}

      {isAdmin ? (
        <View style={{ padding: theme.spacing.lg }}>
          <Button title="+ Add product" onPress={() => navigation.navigate('ProductForm')} />
        </View>
      ) : null}
    </Screen>
  );
}

function ProductRow({
  product,
  currency,
  lowStockThreshold,
  onPress,
  flex,
}: {
  product: Product;
  currency: string;
  lowStockThreshold: number;
  onPress: () => void;
  flex: boolean;
}) {
  const theme = useTheme();
  const low = product.isLowStock(lowStockThreshold);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatMoney(product.sellingPrice, currency)}`}
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }, flex ? { flex: 1 } : null]}
    >
      <Card>
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
            <Txt variant="label" numberOfLines={2}>
              {product.name}
            </Txt>
            <Spacer size={2} />
            <Txt variant="caption" color="muted">
              {product.barcode}
              {product.category ? ` · ${product.category}` : ''}
            </Txt>
          </View>
          <Txt variant="heading">{formatMoney(product.sellingPrice, currency)}</Txt>
        </Row>

        <Spacer size={theme.spacing.sm} />

        <Row gap={theme.spacing.sm}>
          {product.isOutOfStock() ? (
            <Badge label="Out of stock" tone="danger" />
          ) : low ? (
            <Badge label={`Low · ${product.stockQty} left`} tone="warning" />
          ) : (
            <Badge label={`${product.stockQty} in stock`} tone="success" />
          )}
        </Row>
      </Card>
    </Pressable>
  );
}
