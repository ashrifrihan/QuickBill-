/**
 * A full-screen camera sheet that captures ONE barcode and hands it back.
 *
 * This exists so that no screen ever has to make the cashier type a barcode.
 * Any form that needs a code opens this instead of showing a text field
 * (guide §8.2 — the barcode is machine input, not human input).
 *
 * It only captures; it does not decide what the barcode means. The caller does
 * the database lookup and chooses what happens next, which is what lets the
 * same sheet serve "add a product", "find a product" and "scan again".
 */

import React, { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView } from 'expo-camera';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking } from 'react-native';
import { useScanner } from '../hooks/useScanner';
import { useTheme } from '../hooks/useResponsive';
import { Button, Card, Row, Spacer, Txt } from './common';
import { SUPPORTED_BARCODE_TYPES } from '../../config/constants';

export function BarcodeScannerSheet({
  visible,
  onScanned,
  onClose,
  title = 'Scan barcode',
  hint = 'Hold the camera steady over the barcode',
}: {
  visible: boolean;
  /** Called once, with the captured code. The sheet closes itself first. */
  onScanned: (barcode: string) => void;
  onClose: () => void;
  title?: string;
  hint?: string;
}) {
  const theme = useTheme();
  const [torch, setTorch] = useState(false);

  const handleScanned = useCallback(
    (barcode: string) => {
      setTorch(false);
      onScanned(barcode);
    },
    [onScanned],
  );

  // `lookup: false` — this sheet's job is to return digits. The caller decides
  // whether that barcode is a known product.
  const scanner = useScanner({
    lookup: false,
    onScanned: handleScanned,
    autoStart: visible,
  });

  const close = () => {
    setTorch(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={close}
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={styles.flex}>
        {scanner.permissionGranted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            onBarcodeScanned={
              visible && scanner.isActive
                ? (result) => void scanner.handleBarcodeScanned(result)
                : undefined
            }
            barcodeScannerSettings={{ barcodeTypes: [...SUPPORTED_BARCODE_TYPES] }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.background }]} />
        )}

        {/* Permission is handled inline so the sheet never opens to a dead camera. */}
        {!scanner.permissionGranted ? (
          <View style={styles.permissionWrap}>
            <Card>
              <Row gap={theme.spacing.sm}>
                <Ionicons name="camera-outline" size={22} color={theme.colors.text} />
                <Txt variant="heading">Camera access needed</Txt>
              </Row>
              <Spacer size={theme.spacing.sm} />
              <Txt color="muted">
                QuickBill reads barcodes with the camera. Nothing is recorded or uploaded.
              </Txt>
              <Spacer size={theme.spacing.lg} />
              {scanner.permissionDenied ? (
                <Button
                  title="Open device settings"
                  icon="settings-outline"
                  onPress={() => void Linking.openSettings()}
                />
              ) : (
                <Button
                  title="Allow camera"
                  icon="camera-outline"
                  onPress={() => void scanner.requestPermission()}
                />
              )}
              <Spacer size={theme.spacing.sm} />
              <Button title="Cancel" variant="ghost" onPress={close} />
            </Card>
          </View>
        ) : (
          <View style={styles.overlay} pointerEvents="box-none">
            <Row style={styles.topBar}>
              <RoundButton icon="close" onPress={close} accessibilityLabel="Close scanner" />
              <Txt variant="heading" style={styles.onCamera}>
                {title}
              </Txt>
              <RoundButton
                icon={torch ? 'flashlight' : 'flashlight-outline'}
                onPress={() => setTorch((on) => !on)}
                accessibilityLabel={torch ? 'Turn flash off' : 'Turn flash on'}
                active={torch}
              />
            </Row>

            <View style={styles.frameWrap} pointerEvents="none">
              <View
                style={[
                  styles.frame,
                  { borderColor: scanner.phase === 'found' ? theme.colors.success : '#FFFFFF' },
                ]}
              />
              <Spacer size={theme.spacing.lg} />
              <Txt style={styles.onCameraMuted} align="center">
                {scanner.phase === 'found' ? 'Captured' : hint}
              </Txt>
            </View>

            <View style={styles.bottomBar}>
              <Txt variant="caption" style={styles.onCameraMuted} align="center">
                Can&apos;t scan it? Close and use manual entry.
              </Txt>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function RoundButton({
  icon,
  onPress,
  accessibilityLabel,
  active = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.roundButton,
        {
          backgroundColor: active ? '#FFFFFF' : 'rgba(0,0,0,0.5)',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={active ? '#16171D' : '#FFFFFF'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000000' },
  permissionWrap: { flex: 1, justifyContent: 'center', padding: 24 },
  overlay: { flex: 1, justifyContent: 'space-between', paddingTop: 56, paddingBottom: 40 },
  topBar: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  frameWrap: { alignItems: 'center', paddingHorizontal: 24 },
  frame: {
    width: '100%',
    aspectRatio: 1.7,
    borderWidth: 3,
    borderRadius: 20,
  },
  bottomBar: { paddingHorizontal: 24 },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onCamera: { color: '#FFFFFF' },
  onCameraMuted: { color: 'rgba(255,255,255,0.75)' },
});
