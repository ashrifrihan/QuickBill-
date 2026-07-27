/**
 * The scan→cart loop (guide §8.2).
 *
 * Three cases the screen must handle without ever crashing or stalling:
 *  - permission not yet asked / denied → friendly screen, never a crash
 *  - barcode found     → add to cart, haptic confirm, keep scanning
 *  - barcode not found → straight to Add Product with the code pre-filled
 */

import React, { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
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

  const [lastAdded, setLastAdded] = useState<Product | null>(null);

  const handleFound = useCallback(
    (product: Product) => {
      addProduct(product, 1);
      setLastAdded(product);
    },
    [addProduct],
  );

  const handleNotFound = useCallback(
    (barcode: string) => {
      // The real-world flow: add it once, recognised forever after.
      navigation.navigate('Main', {
        screen: 'ProductsTab',
        params: { screen: 'ProductForm', params: { barcode } },
      });
    },
    [navigation],
  );

  const scanner = useScanner({ onFound: handleFound, onNotFound: handleNotFound });
  const { resume, pause } = scanner;

  // Stop the camera when the tab loses focus — it drains battery and holds
  // the hardware open otherwise.
  useFocusEffect(
    useCallback(() => {
      resume();
      return () => pause();
    }, [resume, pause]),
  );

  // --- Permission states (never a crash, guide §8.2) ----------------------

  if (!scanner.permission) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Txt color="muted">Checking camera permission…</Txt>
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
            // Permanently denied: the in-app prompt won't show again, so send
            // them to system settings rather than a dead button.
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
            onPress={() =>
              navigation.navigate('Main', {
                screen: 'ProductsTab',
                params: { screen: 'ProductList' },
              })
            }
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
        // Handing `undefined` while locked stops the callback firing at all.
        onBarcodeScanned={
          scanner.isActive ? (result) => void scanner.handleBarcodeScanned(result) : undefined
        }
        barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODE_TYPES] }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        {/* Visual confirmation the read landed — cashiers rely on it. */}
        <View style={[styles.frame, { borderColor: frameColor }]}>
          <Txt variant="label" style={{ color: '#FFFFFF' }} align="center">
            {scanner.phase === 'looking-up'
              ? 'Looking up…'
              : scanner.phase === 'found'
                ? '✓ Added'
                : scanner.phase === 'not-found'
                  ? 'Unknown barcode'
                  : 'Point at a barcode'}
          </Txt>
        </View>

        <View style={styles.bottom} pointerEvents="box-none">
          {scanner.error ? (
            <Card style={{ marginBottom: theme.spacing.md }}>
              <Txt color="danger" variant="label">
                {scanner.error}
              </Txt>
            </Card>
          ) : null}

          {lastAdded ? (
            <Card style={{ marginBottom: theme.spacing.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={styles.flex}>
                  <Txt variant="label" numberOfLines={1}>
                    {lastAdded.name}
                  </Txt>
                  <Txt variant="caption" color="muted">
                    {formatMoney(lastAdded.sellingPrice, currency)} · added
                  </Txt>
                </View>
                <Txt variant="heading" color="success">
                  ✓
                </Txt>
              </Row>
            </Card>
          ) : null}

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
                borderRadius: theme.radius.lg,
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
  overlay: { flex: 1, justifyContent: 'space-between', padding: 20, paddingTop: 80 },
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
});
