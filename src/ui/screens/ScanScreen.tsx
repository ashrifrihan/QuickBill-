/**
 * The scan→cart loop (guide §8.2) — professional POS workflow.
 *
 * Three cases the screen must handle without ever crashing or stalling:
 *  - permission not yet asked / denied → friendly screen, never a crash
 *  - barcode found     → show product details with qty stepper, "Add to Bill"
 *  - barcode not found → straight to Add Product with the code pre-filled & locked
 */

import React, { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CameraView } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useScanner } from '../hooks/useScanner';
import { useCartStore, useCartTotals } from '../../store/cartStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../hooks/useResponsive';
import { Button, Card, Row, Screen, Spacer, Txt } from '../components/common';
import { formatMoney } from '../../domain/Money';
import { Product } from '../../domain/Product';
import { SUPPORTED_BARCODE_TYPES } from '../../config/constants';
import type { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ScanScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const addProduct = useCartStore((s) => s.addProduct);
  const totals = useCartTotals();
  const currency = useSettingsStore((s) => s.settings.currency);

  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualEntry, setShowManualEntry] = useState(false);

  const handleFound = useCallback(
    (product: Product) => {
      setFoundProduct(product);
      setQty(1);
    },
    [],
  );

  const handleNotFound = useCallback(
    (barcode: string) => {
      // Navigate to product form with barcode pre-filled and locked
      navigation.navigate('Main', {
        screen: 'ProductsTab',
        params: { screen: 'ProductForm', params: { barcode } },
      });
    },
    [navigation],
  );

  const scanner = useScanner({ onFound: handleFound, onNotFound: handleNotFound });
  const { resume, pause } = scanner;

  // Stop the camera when the tab loses focus
  useFocusEffect(
    useCallback(() => {
      resume();
      setFoundProduct(null);
      return () => pause();
    }, [resume, pause]),
  );

  const handleAddToBill = useCallback(() => {
    if (!foundProduct) return;
    addProduct(foundProduct, qty);
    setFoundProduct(null);
    setQty(1);
    resume();
  }, [foundProduct, qty, addProduct, resume]);

  const handleScanAgain = useCallback(() => {
    setFoundProduct(null);
    setQty(1);
    resume();
  }, [resume]);

  const handleManualSearch = useCallback(async () => {
    const barcode = manualBarcode.trim();
    if (!barcode) return;

    const { productService } = await import('../../services/ProductService');
    const product = await productService.findByBarcode(barcode);
    if (product) {
      setFoundProduct(product);
      setQty(1);
      setShowManualEntry(false);
      setManualBarcode('');
    } else {
      setShowManualEntry(false);
      setManualBarcode('');
      navigation.navigate('Main', {
        screen: 'ProductsTab',
        params: { screen: 'ProductForm', params: { barcode } },
      });
    }
  }, [manualBarcode, navigation]);

  // --- Permission states (never a crash, guide §8.2) ----------------------

  if (!scanner.permission) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Txt color="muted">Checking camera permission...</Txt>
        </View>
      </Screen>
    );
  }

  if (!scanner.permissionGranted) {
    return (
      <Screen scroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <Card>
          <Row gap={theme.spacing.sm}>
            <Ionicons name="camera-outline" size={24} color={theme.colors.text} />
            <Txt variant="title">Camera access needed</Txt>
          </Row>
          <Spacer size={theme.spacing.sm} />
          <Txt color="muted">
            QuickBill uses the camera only to read product barcodes. Nothing is recorded or
            uploaded.
          </Txt>
          <Spacer size={theme.spacing.lg} />

          {scanner.permissionDenied ? (
            <>
              <Txt variant="label" color="danger">
                Camera access was turned off for QuickBill.
              </Txt>
              <Spacer size={theme.spacing.md} />
              <Button title="Open device settings" onPress={() => void Linking.openSettings()} />
            </>
          ) : (
            <Button title="Allow camera" onPress={() => void scanner.requestPermission()} />
          )}

          <Spacer size={theme.spacing.md} />
          <Button
            title="Enter barcode manually instead"
            variant="ghost"
            onPress={() => {
              setShowManualEntry(true);
            }}
          />
        </Card>
      </Screen>
    );
  }

  // --- Scanner ------------------------------------------------------------

  const frameColor =
    scanner.phase === 'found'
      ? theme.colors.success
      : scanner.phase === 'not-found'
        ? theme.colors.warning
        : scanner.phase === 'error'
          ? theme.colors.danger
          : '#FFFFFF';

  return (
    <View style={styles.flex}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={scanner.torchOn}
        onBarcodeScanned={
          scanner.isActive ? (result) => void scanner.handleBarcodeScanned(result) : undefined
        }
        barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODE_TYPES] }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        {/* Top action bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={scanner.toggleTorch}
            style={[styles.actionButton, { backgroundColor: scanner.torchOn ? '#FFFFFF' : 'rgba(0,0,0,0.5)' }]}
          >
            <Ionicons
              name={scanner.torchOn ? 'flash' : 'flash-outline'}
              size={20}
              color={scanner.torchOn ? '#16171D' : '#FFFFFF'}
            />
          </Pressable>

          <Pressable
            onPress={() => setShowManualEntry(!showManualEntry)}
            style={[styles.actionButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
          >
            <Ionicons name="keypad-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Manual barcode entry fallback */}
        {showManualEntry ? (
          <View style={styles.manualEntryContainer}>
            <Card style={{ backgroundColor: 'rgba(22,23,29,0.95)' }}>
              <Txt variant="label" style={{ color: '#FFFFFF', marginBottom: 8 }}>
                Enter barcode manually
              </Txt>
              <Row gap={theme.spacing.sm}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    value={manualBarcode}
                    onChangeText={setManualBarcode}
                    placeholder="e.g. 1000000000001"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="default"
                    autoCapitalize="none"
                    returnKeyType="search"
                    onSubmitEditing={handleManualSearch}
                    style={{
                      fontSize: 15,
                      color: '#FFFFFF',
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: 'rgba(255,255,255,0.3)',
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    }}
                  />
                </View>
                <Pressable
                  onPress={handleManualSearch}
                  style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                >
                  <Ionicons name="search" size={20} color={theme.colors.primaryText} />
                </Pressable>
              </Row>
              <Pressable onPress={() => { setShowManualEntry(false); setManualBarcode(''); }} style={{ marginTop: 8 }}>
                <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
                  Cancel
                </Txt>
              </Pressable>
            </Card>
          </View>
        ) : null}

        {/* Scan frame guide */}
        {!foundProduct ? (
          <View style={[styles.frame, { borderColor: frameColor }]}>
            <Txt variant="label" style={{ color: '#FFFFFF' }} align="center">
              {scanner.phase === 'looking-up'
                ? 'Looking up...'
                : scanner.phase === 'found'
                  ? 'Product found'
                  : scanner.phase === 'not-found'
                    ? 'Unknown barcode'
                    : 'Point at a barcode'}
            </Txt>
          </View>
        ) : null}

        {/* Bottom area */}
        <View style={styles.bottom} pointerEvents="box-none">
          {scanner.error ? (
            <Card style={{ marginBottom: theme.spacing.md }}>
              <Txt color="danger" variant="label">
                {scanner.error}
              </Txt>
            </Card>
          ) : null}

          {/* Found product details card with qty stepper + Add to Bill */}
          {foundProduct ? (
            <Card style={{ marginBottom: theme.spacing.md, backgroundColor: 'rgba(22,23,29,0.95)' }}>
              {/* Product info */}
              <Row gap={theme.spacing.sm} style={{ marginBottom: theme.spacing.md }}>
                <View style={[styles.productIconContainer, { backgroundColor: theme.colors.pastelGreen }]}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.pastelGreenText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="label" style={{ color: '#FFFFFF', fontSize: 16 }} numberOfLines={1}>
                    {foundProduct.name}
                  </Txt>
                  <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {foundProduct.barcode}
                    {foundProduct.category ? ` · ${foundProduct.category}` : ''}
                  </Txt>
                </View>
              </Row>

              {/* Price and stock info */}
              <Row style={{ justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
                <View>
                  <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.5)' }}>Selling Price</Txt>
                  <Txt variant="heading" style={{ color: '#FFFFFF' }}>
                    {formatMoney(foundProduct.sellingPrice, currency)}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.5)' }}>In Stock</Txt>
                  <Txt variant="heading" style={{ color: foundProduct.stockQty <= 0 ? '#EF4444' : '#FFFFFF' }}>
                    {foundProduct.stockQty}
                  </Txt>
                </View>
              </Row>

              {/* Quantity stepper */}
              <View style={{ alignItems: 'center', marginBottom: theme.spacing.md }}>
                <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Quantity</Txt>
                <Row gap={theme.spacing.md} style={{ alignItems: 'center' }}>
                  <Pressable
                    onPress={() => setQty((q) => Math.max(1, q - 1))}
                    style={[styles.qtyButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                  >
                    <Ionicons name="remove" size={20} color="#FFFFFF" />
                  </Pressable>
                  <Txt variant="heading" style={{ color: '#FFFFFF', fontSize: 24, minWidth: 40, textAlign: 'center' }}>
                    {qty}
                  </Txt>
                  <Pressable
                    onPress={() => setQty((q) => q + 1)}
                    style={[styles.qtyButton, { backgroundColor: 'rgba(255,255,255,0.15)' }]}
                  >
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                  </Pressable>
                </Row>
              </View>

              {/* Actions */}
              <Pressable
                onPress={handleAddToBill}
                style={({ pressed }) => [
                  styles.addToBillButton,
                  { backgroundColor: theme.colors.primary, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Ionicons name="cart-outline" size={20} color={theme.colors.primaryText} />
                <Txt variant="label" style={{ color: theme.colors.primaryText, marginLeft: 8 }}>
                  Add to Bill ({formatMoney(foundProduct.sellingPrice * qty, currency)})
                </Txt>
              </Pressable>

              <Pressable onPress={handleScanAgain} style={{ marginTop: 10, alignItems: 'center' }}>
                <Row gap={6} style={{ alignItems: 'center' }}>
                  <Ionicons name="scan-outline" size={16} color="rgba(255,255,255,0.6)" />
                  <Txt variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>Scan Next Item</Txt>
                </Row>
              </Pressable>
            </Card>
          ) : null}

          {/* Cart summary bar */}
          <Pressable
            onPress={() => navigation.navigate('Cart')}
            accessibilityRole="button"
            accessibilityLabel={`View cart, ${totals.unitCount} items, total ${formatMoney(
              totals.grandTotal,
              currency,
            )}`}
            style={({ pressed }) => [
              styles.cartBar,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: 14,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View>
              <Txt variant="label" style={{ color: theme.colors.primaryText }}>
                {totals.unitCount} item{totals.unitCount === 1 ? '' : 's'}
              </Txt>
              <Txt variant="caption" style={{ color: theme.colors.primaryText, opacity: 0.85 }}>
                Tap to review the bill
              </Txt>
            </View>
            <Txt variant="heading" style={{ color: theme.colors.primaryText }}>
              {formatMoney(totals.grandTotal, currency)}
            </Txt>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20, paddingTop: 60 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEntryContainer: {
    marginTop: 12,
  },
  frame: {
    alignSelf: 'center',
    width: '85%',
    aspectRatio: 1.6,
    borderWidth: 3,
    borderRadius: 20,
    justifyContent: 'flex-end',
    padding: 12,
  },
  bottom: { paddingBottom: 24 },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    minHeight: 64,
  },
  productIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToBillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
});
