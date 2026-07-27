/** Product details, with the quantity picker and "Add to bill" (guide §12). */

import React, { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProduct } from '../../hooks/useProducts';
import { useCartStore } from '../../../store/cartStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useIsAdmin } from '../../../store/authStore';
import { productService } from '../../../services/ProductService';
import { useTheme } from '../../hooks/useResponsive';
import {
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  LoadingState,
  QtyStepper,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../../components/common';
import { formatMoney } from '../../../domain/Money';
import { formatPercent } from '../../../utils/format';
import { toAppError } from '../../../errors/AppError';
import type { ProductsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<ProductsStackParamList>;
type DetailRoute = RouteProp<ProductsStackParamList, 'ProductDetail'>;

export function ProductDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<DetailRoute>();
  const isAdmin = useIsAdmin();
  const currency = useSettingsStore((s) => s.settings.currency);
  const lowStockThreshold = useSettingsStore((s) => s.settings.lowStockThreshold);
  const addProduct = useCartStore((s) => s.addProduct);

  const { data: product, loading, error, reload } = useProduct(params.productId);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading product…" />
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
  if (!product) {
    return (
      <Screen>
        <ErrorState message="That product no longer exists." onRetry={reload} />
      </Screen>
    );
  }

  const handleAddToBill = () => {
    addProduct(product, quantity);
    setAdded(true);
    setQuantity(1);
  };

  const handleDeactivate = () => {
    // Soft delete, so past invoices keep their meaning.
    Alert.alert(
      'Hide this product?',
      `"${product.name}" will stop appearing in the catalogue. Past bills are unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await productService.deactivate(product.id!);
                navigation.goBack();
              } catch (err) {
                Alert.alert('Could not hide it', toAppError(err).userMessage);
              }
            })();
          },
        },
      ],
    );
  };

  const detail = (label: string, value: string) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
      <Txt color="muted">{label}</Txt>
      <Txt>{value}</Txt>
    </Row>
  );

  return (
    <Screen scroll>
      {product.imageUri ? (
        <>
          <Image
            source={{ uri: product.imageUri }}
            style={{ width: '100%', height: 200, borderRadius: theme.radius.lg }}
            resizeMode="cover"
          />
          <Spacer size={theme.spacing.lg} />
        </>
      ) : null}

      <Card>
        <Txt variant="title">{product.name}</Txt>
        <Spacer size={theme.spacing.xs} />
        <Txt variant="caption" color="muted">
          {product.barcode}
          {product.category ? ` · ${product.category}` : ''}
        </Txt>

        <Spacer size={theme.spacing.md} />

        {product.isOutOfStock() ? (
          <Badge label="Out of stock" tone="danger" />
        ) : product.isLowStock(lowStockThreshold) ? (
          <Badge label={`Low stock · ${product.stockQty} left`} tone="warning" />
        ) : (
          <Badge label={`${product.stockQty} in stock`} tone="success" />
        )}

        <Spacer size={theme.spacing.md} />
        <Divider />
        <Spacer size={theme.spacing.md} />

        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="heading">Price</Txt>
          <Txt variant="title">{formatMoney(product.sellingPrice, currency)}</Txt>
        </Row>

        {/* Cost and margin are the owner's business, not a cashier's. */}
        {isAdmin ? (
          <>
            <Spacer size={theme.spacing.sm} />
            {detail('Cost price', formatMoney(product.purchasePrice, currency))}
            {detail('Margin per unit', formatMoney(product.marginPerUnit(), currency))}
          </>
        ) : null}

        {product.taxRate > 0 ? detail('Tax rate', formatPercent(product.taxRate)) : null}
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Add to bill</Txt>
        <Spacer size={theme.spacing.md} />
        <Row style={{ justifyContent: 'space-between' }}>
          <QtyStepper
            quantity={quantity}
            onIncrease={() => setQuantity((q) => Math.min(9999, q + 1))}
            onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
          />
          <Txt variant="heading">
            {formatMoney(product.sellingPrice * quantity, currency)}
          </Txt>
        </Row>
        <Spacer size={theme.spacing.md} />
        <Button title={added ? '✓ Added — add more?' : 'Add to bill'} onPress={handleAddToBill} />
      </Card>

      {isAdmin ? (
        <>
          <Spacer size={theme.spacing.lg} />
          <Row gap={theme.spacing.md}>
            <View style={{ flex: 1 }}>
              <Button
                title="Edit"
                variant="secondary"
                onPress={() => navigation.navigate('ProductForm', { productId: product.id })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Hide" variant="ghost" onPress={handleDeactivate} />
            </View>
          </Row>
        </>
      ) : null}

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}
