/**
 * Add / edit a product (guide §8.3).
 *
 * Validation is layered (guide §9.2, defence in depth):
 *   1. Zod + React Hook Form here, for instant field-level feedback
 *   2. the `Product` model, which refuses to construct in an invalid state
 *   3. the SQLite UNIQUE index on barcode
 *
 * A screen that forgot to validate still cannot corrupt the database.
 */

import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { productService } from '../../../services/ProductService';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTheme } from '../../hooks/useResponsive';
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
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Pre-filled when arriving from a "not found" scan — the whole point of
      // that flow is that the cashier doesn't retype the code.
      barcode: params?.barcode ?? '',
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
        <LoadingState label="Loading product…" />
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

      <Card>
        {field('barcode', 'Barcode', {
          placeholder: '1000000000001',
          autoCapitalize: 'none',
          keyboardType: 'default',
        })}
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
    </Screen>
  );
}
