/**
 * Choose the print strategy (guide §8.6). The screen only knows about
 * strategy *ids* — PrinterService owns how each one actually prints.
 */

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSettingsStore } from '../../../store/settingsStore';
import { printerService, PrinterStrategyId } from '../../../services/PrinterService';
import { useAsync } from '../../hooks/useAsync';
import { useTheme } from '../../hooks/useResponsive';
import { Badge, Card, ErrorBanner, Row, Screen, Spacer, Txt } from '../../components/common';
import { toAppError } from '../../../errors/AppError';

export function PrinterSettingsScreen() {
  const theme = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const save = useSettingsStore((s) => s.save);
  const [error, setError] = useState<string | null>(null);

  // Ask each strategy whether it can actually run right now, so the screen
  // shows honest availability rather than a promise it can't keep.
  const { data: availability } = useAsync<Record<string, boolean>>(async () => {
    const entries = await Promise.all(
      printerService.listStrategies().map(async (strategy) => {
        try {
          return [strategy.id, await strategy.isAvailable()] as const;
        } catch {
          return [strategy.id, false] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  }, []);

  const select = async (id: PrinterStrategyId) => {
    setError(null);
    try {
      await save({ printerStrategy: id });
    } catch (err) {
      setError(toAppError(err).userMessage);
    }
  };

  return (
    <Screen scroll>
      {error ? (
        <>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      <Txt color="muted">
        Choose how bills are printed. QuickBill always falls back to PDF if the chosen printer
        isn't reachable, so a sale is never blocked by hardware.
      </Txt>

      <Spacer size={theme.spacing.lg} />

      {printerService.listStrategies().map((strategy) => {
        const selected = settings.printerStrategy === strategy.id;
        const available = availability?.[strategy.id] ?? false;

        return (
          <View key={strategy.id}>
            <Pressable
              onPress={() => void select(strategy.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={strategy.label}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Card
                style={{
                  borderColor: selected ? theme.colors.primary : theme.colors.border,
                  borderWidth: selected ? 2 : 1,
                }}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="label">{strategy.label}</Txt>
                    <Spacer size={4} />
                    <Txt variant="caption" color="muted">
                      {strategy.id === 'pdf'
                        ? 'Creates a PDF you can share on WhatsApp, email or save. No hardware needed.'
                        : 'Sends the receipt to a paired 58mm/80mm ESC/POS printer.'}
                    </Txt>
                  </View>
                  {selected ? <Txt color="primary">✓</Txt> : null}
                </Row>

                <Spacer size={theme.spacing.md} />
                <Badge
                  label={available ? 'Ready' : 'Not set up yet'}
                  tone={available ? 'success' : 'neutral'}
                />
              </Card>
            </Pressable>
            <Spacer size={theme.spacing.md} />
          </View>
        );
      })}

      <Card style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Txt variant="label">Bluetooth thermal printing</Txt>
        <Spacer size={theme.spacing.sm} />
        <Txt variant="caption" color="muted">
          This is a Phase 2 feature. The receipt is already formatted for 58mm and 80mm paper — what
          remains is wiring an ESC/POS Bluetooth module into BluetoothPrintStrategy, which needs a
          development build. Until then QuickBill uses PDF automatically.
        </Txt>
      </Card>

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}
