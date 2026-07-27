/**
 * Add / edit a product (guide §8.3) — Professional POS workflow.
 *
 * When arriving from a barcode scan, the barcode field is LOCKED as read-only
 * with a verified badge. The cashier cannot accidentally modify the scanned code.
 *
 * Validation is layered (guide §9.2, defence in depth):
 *   1. Zod + React Hook Form here, for instant field-level feedback
 *   2. the `Product` model, which refuses to construct in an invalid state
 *   3. the SQLite UNIQUE index on barcode
 *
 * A screen that forgot to validate still cannot corrupt the database.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { CameraView } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { productService } from '../../../services/ProductService';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTheme } from '../../hooks/useResponsive';
import { useScanner } from '../../hooks/useScanner';
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  LoadingState,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../../components/common';
import { parseMoney } from '../../../domain/Money';
import { toAppError, ValidationError } from '../../../errors/AppError';
import { SUPPORTED_BARCODE_TYPES } from '../../../config/constants';
import type { ProductsStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<ProductsStackParamList>;
type FormRoute = RouteProp<ProductsStackParamList, 'ProductForm'>;

/** A money field: must parse, and must not be negative. */
const moneyField = (label: string) =>
  z.string().refine(
    (value) => {
      const parsed = parseMoney(value);
      return parsed !== null && parsed >= 0;
    },
    { message: `Enter a valid ${label}.` },
  );

const schema = z.object({
  barcode: z.string().trim().min(1, 'Barcode is required.').max(64, 'Barcode is too long.'),
  name: z.string().trim().min(1, 'Product name is required.').max(120, 'Name is too long.'),
  category: z.string().trim().optional(),
  purchasePrice: moneyField('purchase price'),
  sellingPrice: moneyField('selling price'),
  taxPercent: z
    .string()
    .refine((value) => {
      if (value.trim() === '') return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
    }, { message: 'Tax must be between 0 and 100.' }),
  stockQty: z.string().refine((value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0;
  }, { message: 'Stock must be a whole number, zero or more.' }),
});

type FormValues = z.infer<typeof schema>;

export function ProductFormScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { params } = useRoute<FormRoute>();
  const defaultTaxRate = useSettingsStore((s) => s.settings.taxRate);

  const isEdit = params?.productId !== undefined;
  // Barcode is locked when it came from a scan (not user-typed)
  const barcodeFromScan = params?.barcode ?? '';
  const [barcodeIsLocked, setBarcodeIsLocked] = useState(!!barcodeFromScan);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      barcode: barcodeFromScan,
      name: '',
      category: '',
      purchasePrice: '',
      sellingPrice: '',
      taxPercent: defaultTaxRate ? String(defaultTaxRate * 100) : '',
      stockQty: '0',
    },
  });

  useEffect(() => {
    if (!isEdit || params?.productId === undefined) return;

    let cancelled = false;
    void (async () => {
      try {
        const product = await productService.findById(params.productId!);
        if (cancelled || !product) return;
        reset({
          barcode: product.barcode,
          name: product.name,
          category: product.category ?? '',
          purchasePrice: (product.purchasePrice / 100).toFixed(2),
          sellingPrice: (product.sellingPrice / 100).toFixed(2),
          taxPercent: product.taxRate ? String(product.taxRate * 100) : '',
          stockQty: String(product.stockQty),
        });
        setImageUri(product.imageUri);
        // Editing an existing product: barcode is always locked
        setBarcodeIsLocked(true);
      } catch (error) {
        if (!cancelled) setSubmitError(toAppError(error).userMessage);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEdit, params?.productId, reset]);

  const handleScanBarcode = useCallback((barcode: string) => {
    setValue('barcode', barcode);
    setBarcodeIsLocked(true);
    setShowScannerModal(false);
  }, [setValue]);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setSubmitError('Photo access is off. You can still save the product without an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsEditing: true,
      });
      if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
    } catch {
      // A photo is optional; never block the form over it.
      setSubmitError('Could not open the photo library.');
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        id: params?.productId,
        barcode: values.barcode.trim(),
        name: values.name.trim(),
        category: values.category?.trim() || null,
        purchasePrice: parseMoney(values.purchasePrice) ?? 0,
        sellingPrice: parseMoney(values.sellingPrice) ?? 0,
        taxRate: values.taxPercent.trim() === '' ? 0 : Number(values.taxPercent) / 100,
        stockQty: Number(values.stockQty),
        imageUri,
      };

      if (isEdit) await productService.update(input);
      else await productService.create(input);

      navigation.goBack();
    } catch (error) {
      const appError = toAppError(error);
      // Map field-level errors from the model/repository back onto the form.
      if (appError instanceof ValidationError && appError.fields) {
        for (const [field, message] of Object.entries(appError.fields)) {
          if (field in schema.shape) {
            setError(field as keyof FormValues, { message });
          }
        }
      }
      setSubmitError(appError.userMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState label="Loading product..." />
      </Screen>
    );
  }

  const field = (
    name: keyof FormValues,
    label: string,
    extra: Partial<React.ComponentProps<typeof Field>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Field
          label={label}
          value={value ?? ''}
          onChangeText={onChange}
          onBlur={onBlur}
          error={errors[name]?.message}
          {...extra}
        />
      )}
    />
  );

  return (
    <Screen scroll>
      {submitError ? (
        <>
          <ErrorBanner message={submitError} onDismiss={() => setSubmitError(null)} />
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      {/* Scan Barcode CTA Button — opens camera scanner */}
      {!barcodeIsLocked && !isEdit ? (
        <>
          <Pressable
            onPress={() => setShowScannerModal(true)}
            style={({ pressed }) => [
              styles.scanButton,
              {
                backgroundColor: theme.colors.primary,
                borderRadius: 14,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons name="scan" size={22} color={theme.colors.primaryText} />
            <Txt variant="label" style={{ color: theme.colors.primaryText, marginLeft: 10, fontSize: 16 }}>
              Scan Barcode
            </Txt>
          </Pressable>
          <Spacer size={theme.spacing.lg} />
        </>
      ) : null}

      {/* Barcode Card */}
      <Card>
        <Controller
          control={control}
          name="barcode"
          render={({ field: { onChange, onBlur, value } }) => (
            <Field
              label="Barcode"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.barcode?.message}
              placeholder="1000000000001"
              autoCapitalize="none"
              keyboardType="default"
              readOnly={barcodeIsLocked}
              verified={barcodeIsLocked && !!value}
              rightElement={
                barcodeIsLocked ? (
                  <Pressable
                    onPress={() => {
                      setShowScannerModal(true);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: `${theme.colors.primary}15`,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Ionicons name="scan-outline" size={16} color={theme.colors.primary} />
                    <Txt variant="caption" style={{ color: theme.colors.primary, marginLeft: 4, fontWeight: '600' }}>
                      Scan Again
                    </Txt>
                  </Pressable>
                ) : undefined
              }
            />
          )}
        />
        <Spacer size={theme.spacing.md} />
        {field('name', 'Product name', { placeholder: 'Tea 100g' })}
        <Spacer size={theme.spacing.md} />
        {field('category', 'Category (optional)', { placeholder: 'Beverages' })}
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Pricing</Txt>
        <Spacer size={theme.spacing.md} />
        <Row gap={theme.spacing.md}>
          <View style={{ flex: 1 }}>
            {field('purchasePrice', 'Cost price', {
              placeholder: '80.00',
              keyboardType: 'decimal-pad',
            })}
          </View>
          <View style={{ flex: 1 }}>
            {field('sellingPrice', 'Selling price', {
              placeholder: '100.00',
              keyboardType: 'decimal-pad',
            })}
          </View>
        </Row>
        <Spacer size={theme.spacing.md} />
        <Row gap={theme.spacing.md}>
          <View style={{ flex: 1 }}>
            {field('taxPercent', 'Tax %', { placeholder: '0', keyboardType: 'decimal-pad' })}
          </View>
          <View style={{ flex: 1 }}>
            {field('stockQty', 'Stock quantity', { placeholder: '0', keyboardType: 'number-pad' })}
          </View>
        </Row>
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Photo (optional)</Txt>
        <Spacer size={theme.spacing.md} />
        {imageUri ? (
          <>
            <Image
              source={{ uri: imageUri }}
              style={{ width: '100%', height: 160, borderRadius: theme.radius.md }}
              resizeMode="cover"
            />
            <Spacer size={theme.spacing.sm} />
            <Row gap={theme.spacing.sm}>
              <Button title="Change" variant="secondary" size="small" onPress={pickImage} />
              <Button
                title="Remove"
                variant="ghost"
                size="small"
                onPress={() => setImageUri(null)}
              />
            </Row>
          </>
        ) : (
          <Button title="Pick a photo" variant="secondary" onPress={pickImage} />
        )}
      </Card>

      <Spacer size={theme.spacing.xl} />

      <Button
        title={isEdit ? 'Save changes' : 'Add product'}
        size="large"
        onPress={handleSubmit(onSubmit)}
        loading={submitting}
        disabled={submitting}
      />
      <Spacer size={theme.spacing.sm} />
      <Button title="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
      <Spacer size={theme.spacing.xl} />

      {/* Scanner Modal for barcode capture */}
      <BarcodeScannerModal
        visible={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanned={handleScanBarcode}
      />
    </Screen>
  );
}

/** Full-screen modal camera scanner for capturing a barcode on the product form */
function BarcodeScannerModal({
  visible,
  onClose,
  onScanned,
}: {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}) {
  const theme = useTheme();

  const handleCapture = useCallback(
    (barcode: string) => {
      onScanned(barcode);
    },
    [onScanned],
  );

  const scanner = useScanner({
    lookup: false,
    onScanned: handleCapture,
    autoStart: visible,
  });

  // Always-stable barcode handler — never toggle the prop between function
  // and undefined; expo-camera v57 won't re-register the listener reliably.
  const stableOnBarcodeScanned = useCallback(
    (result: { data: string }) => {
      void scanner.handleBarcodeScanned(result);
    },
    [scanner.handleBarcodeScanned],
  );

  // Resume scanner when modal opens
  useEffect(() => {
    if (visible) {
      scanner.resume();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const frameColor =
    scanner.phase === 'found' ? theme.colors.success : '#FFFFFF';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.flex}>
        {visible ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={scanner.torchOn}
            onBarcodeScanned={stableOnBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODE_TYPES] }}
          />
        ) : null}

        <View style={styles.modalOverlay} pointerEvents="box-none">
          {/* Top bar with close and torch */}
          <View style={styles.modalTopBar}>
            <Pressable
              onPress={onClose}
              style={[styles.modalActionButton, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>

            <Txt variant="label" style={{ color: '#FFFFFF', fontSize: 16 }}>
              Scan Barcode
            </Txt>

            <Pressable
              onPress={scanner.toggleTorch}
              style={[
                styles.modalActionButton,
                { backgroundColor: scanner.torchOn ? '#FFFFFF' : 'rgba(0,0,0,0.5)' },
              ]}
            >
              <Ionicons
                name={scanner.torchOn ? 'flash' : 'flash-outline'}
                size={20}
                color={scanner.torchOn ? '#16171D' : '#FFFFFF'}
              />
            </Pressable>
          </View>

          {/* Frame */}
          <View style={[styles.frame, { borderColor: frameColor }]}>
            <Txt variant="label" style={{ color: '#FFFFFF' }} align="center">
              {scanner.phase === 'looking-up'
                ? 'Reading...'
                : scanner.phase === 'found'
                  ? 'Captured'
                  : 'Point at a barcode'}
            </Txt>
          </View>

          <View style={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cancelButton,
                { backgroundColor: 'rgba(255,255,255,0.15)', opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Txt variant="label" style={{ color: '#FFFFFF' }}>Cancel</Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
  },
  modalTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActionButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
});
