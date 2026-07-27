/**
 * Product catalogue (guide §12), laid out as a two-column visual grid.
 *
 * Cards are image-led: a cashier recognises a product by sight far faster than
 * by reading a row of text. Products without a photo fall back to a coloured
 * tile with the initial, so the grid never looks broken or empty.
 */

import React, { useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useProducts, useProductCategories } from '../../hooks/useProducts';
import { useSettingsStore } from '../../../store/settingsStore';
import { useIsAdmin } from '../../../store/authStore';
import { useResponsive, useTheme } from '../../hooks/useResponsive';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../../components/common';
import { BarcodeScannerSheet } from '../../components/BarcodeScannerSheet';
import { Select } from '../../components/Select';
import { formatMoney } from '../../../domain/Money';
import { Product } from '../../../domain/Product';
import { productService } from '../../../services/ProductService';
import { toAppError } from '../../../errors/AppError';
import { logger } from '../../../errors/logger';
import { TAB_BAR_CLEARANCE } from '../../../config/constants';
import type { ProductsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<ProductsStackParamList>;
type ListRoute = RouteProp<ProductsStackParamList, 'ProductList'>;

/** Rotating tints so a grid of photo-less products still reads as a grid. */
const TILE_TINTS = ['purple', 'green', 'blue', 'yellow', 'pink'] as const;

export function ProductListScreen() {
  const theme = useTheme();
  const { columns } = useResponsive();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<ListRoute>();
  const isAdmin = useIsAdmin();
  const currency = useSettingsStore((s) => s.settings.currency);
  const categories = useProductCategories();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const {
    products,
    search,
    setSearch,
    category,
    setCategory,
    initialLoading,
    error,
    reload,
    isEmpty,
    lowStockThreshold,
  } = useProducts({ onlyLowStock: params?.lowStockOnly });

  /** Scan to jump straight to a product — no typing, no scrolling. */
  const handleScanned = async (barcode: string) => {
    setScannerOpen(false);
    setScanError(null);
    try {
      const product = await productService.findByBarcode(barcode);
      if (product?.id !== undefined) {
        navigation.navigate('ProductDetail', { productId: product.id });
      } else {
        // Unknown code: go straight to Add Product with it pre-filled.
        navigation.navigate('ProductForm', { barcode });
      }
    } catch (err) {
      logger.error('Scan-to-find lookup failed', err, { barcode });
      setScanError(toAppError(err).userMessage);
    }
  };

  const gridColumns = Math.max(2, columns);

  const header = (
    <View style={{ paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm }}>
      <Txt variant="title" style={{ fontSize: 28, fontWeight: '700' }}>
        Products
      </Txt>
      <Spacer size={2} />
      <Txt variant="caption" color="muted">
        {products.length} item{products.length === 1 ? '' : 's'} in your catalogue
      </Txt>

      <Spacer size={theme.spacing.lg} />

      {/* Search + scan. Scanning is the fast path, so it sits right beside it. */}
      <Row gap={theme.spacing.sm}>
        <View style={{ flex: 1 }}>
          <Field
            value={search}
            onChangeText={setSearch}
            placeholder="Search name or barcode…"
            icon="search-outline"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <Pressable
          onPress={() => setScannerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Scan a barcode to find a product"
          style={({ pressed }) => [
            styles.scanSquare,
            {
              backgroundColor: theme.colors.darkCapsule,
              borderRadius: theme.radius.lg,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="scan-outline" size={22} color="#FFFFFF" />
        </Pressable>
      </Row>

      {scanError ? (
        <>
          <Spacer size={theme.spacing.sm} />
          <Txt variant="caption" color="danger">
            {scanError}
          </Txt>
        </>
      ) : null}

      {params?.lowStockOnly ? (
        <>
          <Spacer size={theme.spacing.md} />
          <Badge label={`Low stock — ${lowStockThreshold} units or fewer`} tone="warning" />
        </>
      ) : null}

      {/*
        A dropdown rather than a chip row: once a shop has more than a few
        categories the chips scroll off-screen and the active one can end up
        hidden. A select always shows what is currently filtered.
      */}
      {categories.length > 0 ? (
        <>
          <Spacer size={theme.spacing.md} />
          <Select<string | null>
            value={category}
            onChange={setCategory}
            title="Filter by category"
            placeholder="All categories"
            options={[
              { value: null, label: 'All categories', hint: String(products.length) },
              ...categories.map((name) => ({ value: name, label: name })),
            ]}
          />
        </>
      ) : null}

      <Spacer size={theme.spacing.lg} />
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
      <FlatList
        data={products}
        ListHeaderComponent={header}
        // Remount when the column count changes on rotation.
        key={`cols-${gridColumns}`}
        numColumns={gridColumns}
        columnWrapperStyle={{ gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg }}
        keyExtractor={(product) => String(product.id)}
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE + 60,
          gap: theme.spacing.md,
        }}
        onRefresh={reload}
        refreshing={false}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={search || category ? 'No matches' : 'No products yet'}
            message={
              search || category
                ? 'Try a different search or category.'
                : 'Scan a barcode and QuickBill will offer to add the product.'
            }
            actionLabel={isAdmin && !search ? 'Scan to add' : undefined}
            onAction={isAdmin && !search ? () => setScannerOpen(true) : undefined}
          />
        }
        renderItem={({ item, index }) => (
          <ProductTile
            product={item}
            currency={currency}
            lowStockThreshold={lowStockThreshold}
            tint={TILE_TINTS[index % TILE_TINTS.length]}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id! })}
          />
        )}
      />

      {/* Floating add button, lifted clear of the capsule tab bar. */}
      {isAdmin ? (
        <View style={[styles.fab, { bottom: TAB_BAR_CLEARANCE }]} pointerEvents="box-none">
          <Button
            title="Add product"
            icon="add"
            onPress={() => navigation.navigate('ProductForm')}
            style={{ paddingHorizontal: theme.spacing.xl }}
          />
        </View>
      ) : null}

      <BarcodeScannerSheet
        visible={scannerOpen}
        onScanned={(barcode) => void handleScanned(barcode)}
        onClose={() => setScannerOpen(false)}
        title="Find product"
        hint="Scan a product to open it"
      />
    </Screen>
  );
}

function ProductTile({
  product,
  currency,
  lowStockThreshold,
  tint,
  onPress,
}: {
  product: Product;
  currency: string;
  lowStockThreshold: number;
  tint: (typeof TILE_TINTS)[number];
  onPress: () => void;
}) {
  const theme = useTheme();
  const out = product.isOutOfStock();
  const low = product.isLowStock(lowStockThreshold);

  const tintBg = {
    purple: theme.colors.pastelPurple,
    green: theme.colors.pastelGreen,
    blue: theme.colors.pastelBlue,
    yellow: theme.colors.pastelYellow,
    pink: theme.colors.pastelPink,
  }[tint];

  const tintFg = {
    purple: theme.colors.pastelPurpleText,
    green: theme.colors.pastelGreenText,
    blue: theme.colors.pastelBlueText,
    yellow: theme.colors.pastelYellowText,
    pink: theme.colors.pastelPinkText,
  }[tint];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatMoney(product.sellingPrice, currency)}, ${
        out ? 'out of stock' : `${product.stockQty} in stock`
      }`}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.tileInner, { borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceAlt }]}>
        {product.imageUri ? (
          <Image source={{ uri: product.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tintBg }]}>
            <View style={styles.placeholderCenter}>
              <Txt style={{ fontSize: 34, fontWeight: '700', color: tintFg }}>
                {product.name.charAt(0).toUpperCase()}
              </Txt>
            </View>
          </View>
        )}

        {/* Stock pill, top-left */}
        <View style={styles.topLeft}>
          <View
            style={[
              styles.pill,
              { backgroundColor: out ? theme.colors.danger : low ? theme.colors.warning : theme.colors.success },
            ]}
          >
            <Ionicons
              name={out ? 'close-circle' : low ? 'alert-circle' : 'checkmark-circle'}
              size={12}
              color="#FFFFFF"
            />
            <Txt style={styles.pillText}>{out ? 'Out' : `${product.stockQty}`}</Txt>
          </View>
        </View>

        {/* Price pill, top-right */}
        <View style={styles.topRight}>
          <View style={[styles.pill, { backgroundColor: 'rgba(22,23,29,0.82)' }]}>
            <Txt style={styles.pillText}>{formatMoney(product.sellingPrice, currency)}</Txt>
          </View>
        </View>

        {/* Legibility scrim + title, bottom */}
        <View style={styles.tileFooter}>
          <View style={styles.scrim} />
          <View style={{ padding: 10 }}>
            <Txt style={styles.tileTitle} numberOfLines={1}>
              {product.name}
            </Txt>
            <Row gap={3} style={{ marginTop: 2 }}>
              <Ionicons name="pricetag-outline" size={11} color="rgba(255,255,255,0.85)" />
              <Txt style={styles.tileSub} numberOfLines={1}>
                {product.category ?? 'Uncategorised'}
              </Txt>
            </Row>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scanSquare: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: { flex: 1 },
  tileInner: {
    width: '100%',
    aspectRatio: 0.86,
    overflow: 'hidden',
  },
  placeholderCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topLeft: { position: 'absolute', top: 8, left: 8 },
  topRight: { position: 'absolute', top: 8, right: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  tileFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tileTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  tileSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  fab: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
