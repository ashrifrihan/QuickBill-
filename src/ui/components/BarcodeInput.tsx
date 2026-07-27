/**
 * The barcode control.
 *
 * A barcode is machine input. Typing 13 digits by hand at a counter is slow and
 * a single wrong digit silently creates a duplicate product that will never
 * scan again — so this control is scan-first and read-only once captured.
 *
 * Three states:
 *   empty     → a big "Scan barcode" button; manual entry is a small fallback
 *   captured  → read-only digits + "Verified" + "Scan again"
 *   manual    → an explicit, deliberate typing mode the user opted into
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BarcodeScannerSheet } from './BarcodeScannerSheet';
import { useTheme } from '../hooks/useResponsive';
import { Badge, Button, Row, Spacer, Txt } from './common';
import { MIN_TOUCH_TARGET } from '../../config/constants';

export type BarcodeSource = 'scan' | 'manual';

export interface BarcodeStatus {
  tone: 'success' | 'warning' | 'danger';
  label: string;
}

export function BarcodeInput({
  value,
  onChange,
  error,
  status,
  label = 'Barcode',
  scanTitle = 'Scan barcode',
  /** Edit mode: the code already belongs to a saved product. */
  existing = false,
}: {
  value: string;
  onChange: (barcode: string, source: BarcodeSource) => void;
  error?: string;
  status?: BarcodeStatus | null;
  label?: string;
  scanTitle?: string;
  existing?: boolean;
}) {
  const theme = useTheme();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const hasValue = value.trim() !== '';

  const handleScanned = (barcode: string) => {
    setScannerOpen(false);
    setManualMode(false);
    onChange(barcode, 'scan');
  };

  const statusTone =
    status?.tone === 'danger'
      ? theme.colors.danger
      : status?.tone === 'warning'
        ? theme.colors.warning
        : theme.colors.success;

  return (
    <View>
      <Txt variant="label" color="muted">
        {label}
      </Txt>
      <Spacer size={theme.spacing.xs} />

      {hasValue && !manualMode ? (
        // -------- captured: read-only, so a stray tap can't corrupt it -------
        <View
          style={[
            styles.captured,
            {
              backgroundColor: theme.colors.surfaceAlt,
              borderRadius: theme.radius.lg,
              borderColor: error ? theme.colors.danger : 'transparent',
            },
          ]}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Txt
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  letterSpacing: 1.5,
                  fontVariant: ['tabular-nums'],
                }}
                numberOfLines={1}
              >
                {value}
              </Txt>
              <Spacer size={6} />
              {status ? (
                <Row gap={6}>
                  <Ionicons
                    name={
                      status.tone === 'success'
                        ? 'checkmark-circle'
                        : status.tone === 'warning'
                          ? 'alert-circle'
                          : 'close-circle'
                    }
                    size={15}
                    color={statusTone}
                  />
                  <Txt variant="caption" style={{ color: statusTone, fontWeight: '600' }}>
                    {status.label}
                  </Txt>
                </Row>
              ) : (
                <Row gap={6}>
                  <Ionicons name="checkmark-circle" size={15} color={theme.colors.success} />
                  <Txt variant="caption" style={{ color: theme.colors.success, fontWeight: '600' }}>
                    Verified
                  </Txt>
                </Row>
              )}
            </View>

            {existing ? (
              <Badge label="LOCKED" tone="neutral" />
            ) : (
              <Pressable
                onPress={() => setScannerOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Scan a different barcode"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.scanAgain,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.pill,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="scan-outline" size={16} color={theme.colors.text} />
                <Txt variant="caption" style={{ fontWeight: '700' }}>
                  Scan again
                </Txt>
              </Pressable>
            )}
          </Row>
        </View>
      ) : manualMode ? (
        // -------- manual: opted into deliberately -----------------------------
        <View>
          <Row
            style={{
              minHeight: MIN_TOUCH_TARGET + 6,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.lg,
              paddingHorizontal: theme.spacing.md,
            }}
          >
            <Ionicons name="barcode-outline" size={18} color={theme.colors.textMuted} />
            <TextInput
              value={value}
              onChangeText={(text) => onChange(text, 'manual')}
              placeholder="Type the barcode digits"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={label}
              autoFocus
              style={{
                flex: 1,
                marginLeft: 8,
                fontSize: 17,
                letterSpacing: 1.2,
                color: theme.colors.text,
                paddingVertical: 10,
              }}
            />
          </Row>
          <Spacer size={theme.spacing.sm} />
          <Button
            title="Scan instead"
            icon="scan-outline"
            variant="secondary"
            size="small"
            onPress={() => {
              setManualMode(false);
              setScannerOpen(true);
            }}
          />
        </View>
      ) : (
        // -------- empty: scanning is the obvious path ------------------------
        <View>
          <Button
            title={scanTitle}
            icon="scan-outline"
            size="large"
            onPress={() => setScannerOpen(true)}
          />
          <Spacer size={theme.spacing.sm} />
          <Pressable
            onPress={() => setManualMode(true)}
            accessibilityRole="button"
            accessibilityLabel="Enter the barcode manually instead"
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: 'center' })}
          >
            <Txt variant="caption" color="muted">
              or enter it manually
            </Txt>
          </Pressable>
        </View>
      )}

      {error ? (
        <>
          <Spacer size={theme.spacing.xs} />
          <Txt variant="caption" color="danger">
            {error}
          </Txt>
        </>
      ) : null}

      <BarcodeScannerSheet
        visible={scannerOpen}
        onScanned={handleScanned}
        onClose={() => setScannerOpen(false)}
        title={scanTitle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  captured: { padding: 14, borderWidth: 1.5 },
  scanAgain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: MIN_TOUCH_TARGET - 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
