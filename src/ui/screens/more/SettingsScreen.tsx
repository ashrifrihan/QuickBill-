/** Shop settings, stored as key/value rows (guide §8.8). Admin only. */

import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSettingsStore } from '../../../store/settingsStore';
import { resetDatabase } from '../../../data';
import { reportService } from '../../../services/ReportService';
import { useCartStore } from '../../../store/cartStore';
import { useTheme } from '../../hooks/useResponsive';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../../components/common';
import { toAppError } from '../../../errors/AppError';

export function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const clearCart = useCartStore((s) => s.clear);

  const [shopName, setShopName] = useState(settings.shopName);
  const [shopAddress, setShopAddress] = useState(settings.shopAddress);
  const [shopPhone, setShopPhone] = useState(settings.shopPhone);
  const [currency, setCurrency] = useState(settings.currency);
  const [taxPercent, setTaxPercent] = useState(String(settings.taxRate * 100));
  const [lowStock, setLowStock] = useState(String(settings.lowStockThreshold));
  const [invoicePrefix, setInvoicePrefix] = useState(settings.invoicePrefix);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setError(null);

    const tax = Number(taxPercent);
    if (!Number.isFinite(tax) || tax < 0 || tax > 100) {
      setError('Tax rate must be between 0 and 100.');
      return;
    }
    const threshold = Number(lowStock);
    if (!Number.isInteger(threshold) || threshold < 0) {
      setError('Low-stock alert must be a whole number, zero or more.');
      return;
    }
    if (!shopName.trim()) {
      setError('Shop name cannot be blank — it appears on every bill.');
      return;
    }

    setSaving(true);
    try {
      await save({
        shopName: shopName.trim(),
        shopAddress: shopAddress.trim(),
        shopPhone: shopPhone.trim(),
        currency: currency.trim() || 'LKR',
        taxRate: tax / 100,
        lowStockThreshold: threshold,
        invoicePrefix: invoicePrefix.trim() || 'INV',
      });
      reportService.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(toAppError(err).userMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      'Erase all data?',
      'This permanently deletes every product and bill on this device. Your account and settings are kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await resetDatabase();
                clearCart();
                reportService.invalidate();
                Alert.alert('Done', 'All products and bills have been erased.');
                navigation.goBack();
              } catch (err) {
                Alert.alert('Could not erase', toAppError(err).userMessage);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      {error ? (
        <>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      <Card>
        <Txt variant="heading">Shop</Txt>
        <Spacer size={theme.spacing.md} />
        <Field
          label="Shop name"
          value={shopName}
          onChangeText={setShopName}
          hint="Printed at the top of every bill."
        />
        <Spacer size={theme.spacing.md} />
        <Field label="Address" value={shopAddress} onChangeText={setShopAddress} />
        <Spacer size={theme.spacing.md} />
        <Field
          label="Phone"
          value={shopPhone}
          onChangeText={setShopPhone}
          keyboardType="phone-pad"
        />
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Billing</Txt>
        <Spacer size={theme.spacing.md} />
        <Row gap={theme.spacing.md}>
          <View style={{ flex: 1 }}>
            <Field
              label="Currency"
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Default tax %"
              value={taxPercent}
              onChangeText={setTaxPercent}
              keyboardType="decimal-pad"
              hint="Applied to new products."
            />
          </View>
        </Row>
        <Spacer size={theme.spacing.md} />
        <Row gap={theme.spacing.md}>
          <View style={{ flex: 1 }}>
            <Field
              label="Bill number prefix"
              value={invoicePrefix}
              onChangeText={setInvoicePrefix}
              autoCapitalize="characters"
              maxLength={8}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Low-stock alert at"
              value={lowStock}
              onChangeText={setLowStock}
              keyboardType="number-pad"
            />
          </View>
        </Row>
      </Card>

      <Spacer size={theme.spacing.xl} />

      <Button
        title={saved ? '✓ Saved' : 'Save settings'}
        size="large"
        onPress={handleSave}
        loading={saving}
        disabled={saving}
      />

      <Spacer size={theme.spacing.xxl} />

      <Card>
        <Txt variant="heading" color="danger">
          Danger zone
        </Txt>
        <Spacer size={theme.spacing.sm} />
        <Txt variant="caption" color="muted">
          Erase all products and bills from this device. Useful after testing, before going live in
          a real shop.
        </Txt>
        <Spacer size={theme.spacing.md} />
        <Button title="Erase all data" variant="danger" onPress={handleReset} />
      </Card>

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}
