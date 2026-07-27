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
    <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
      <Field
        value={search}
        onChangeText={setSearch}
        placeholder="Search product name or barcode…"
        icon="search-outline"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {params?.lowStockOnly ? (
        <>
          <Spacer size={theme.spacing.sm} />
          <Badge label={`Low Stock Alert (≤ ${lowStockThreshold} units)`} tone="warning" />
        </>
      ) : null}
    </View>
  );

  if (initialLoading) {
    return (
      <Screen>
        <LoadingState label="Loading product catalogue…" />
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
          icon="cube-outline"
          title={search ? 'No matches found' : 'No products yet'}
          message={
            search
              ? 'Try searching with a different product name or barcode.'
              : 'Add your first product to start taking orders!'
          }
          actionLabel={isAdmin && !search ? 'Add Product' : undefined}
          onAction={isAdmin && !search ? () => navigation.navigate('ProductForm') : undefined}
        />
      ) : (
        <FlatList
          data={products}
          key={`cols-${columns}`}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: theme.spacing.md } : undefined}
          keyExtractor={(product) => String(product.id)}
          contentContainerStyle={{
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: 110,
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
        <View style={{ position: 'absolute', right: 20, bottom: 90 }}>
          <Button
            title="+ Add Product"
            variant="purple"
            size="medium"
            onPress={() => navigation.navigate('ProductForm')}
          />
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
      style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }, flex ? { flex: 1 } : null]}
    >
      <Card variant="surface" radiusSize="xl">
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, paddingRight: theme.spacing.md }}>
            <Txt variant="label" style={{ fontSize: 16, fontWeight: '700' }} numberOfLines={2}>
              {product.name}
            </Txt>
            <Spacer size={4} />
            <Txt variant="caption" color="muted">
              {product.barcode}
              {product.category ? ` · ${product.category}` : ''}
            </Txt>
          </View>
          <Txt variant="heading" style={{ color: theme.colors.text, fontSize: 17, fontWeight: '700' }}>
            {formatMoney(product.sellingPrice, currency)}
          </Txt>
        </Row>

        <Spacer size={theme.spacing.md} />

        <Row gap={theme.spacing.sm}>
          {product.isOutOfStock() ? (
            <Badge label="Out of Stock" tone="danger" />
          ) : low ? (
            <Badge label={`Low Stock (${product.stockQty} left)`} tone="warning" />
          ) : (
            <Badge label={`${product.stockQty} in stock`} tone="green" />
          )}
        </Row>
      </Card>
    </Pressable>
  );
}
