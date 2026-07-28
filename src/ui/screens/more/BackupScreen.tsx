/**
 * Export / import the whole shop (Profile → Backup & restore).
 *
 * Importing can destroy data, so the flow is deliberately two-step: pick a
 * file, see exactly what is in it, THEN choose how to apply it. Nothing is
 * written to the database until that second confirmation.
 */

import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSettingsStore } from '../../../store/settingsStore';
import { useCartStore } from '../../../store/cartStore';
import { useAuthStore } from '../../../store/authStore';
import { backupService, BackupFile, BackupSummary } from '../../../services/BackupService';
import { reportService } from '../../../services/ReportService';
import { useTheme } from '../../hooks/useResponsive';
import {
  Button,
  Card,
  Divider,
  ErrorBanner,
  Row,
  Screen,
  Spacer,
  Txt,
} from '../../components/common';
import { toAppError } from '../../../errors/AppError';
import { formatDateTime } from '../../../utils/format';

type Busy = 'idle' | 'exporting' | 'reading' | 'restoring';

export function BackupScreen() {
  const theme = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const reloadSettings = useSettingsStore((s) => s.load);
  const clearCart = useCartStore((s) => s.clear);
  const signOut = useAuthStore((s) => s.signOut);

  const [busy, setBusy] = useState<Busy>('idle');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  /** A parsed, validated backup waiting for the user to choose how to apply it. */
  const [staged, setStaged] = useState<{ backup: BackupFile; summary: BackupSummary } | null>(null);

  const idle = busy === 'idle';

  // ---------------------------------------------------------------- export
  const handleExport = async () => {
    setError(null);
    setNote(null);
    setBusy('exporting');
    try {
      const result = await backupService.exportToFile({ shopName: settings.shopName });

      setNote(
        result.shared
          ? { ok: true, text: `Backup exported — ${result.fileName}` }
          : {
              ok: false,
              text: `${result.shareError ?? 'The file was not sent.'} It is saved on this device as ${result.fileName}.`,
            },
      );
    } catch (err) {
      setError(toAppError(err).userMessage);
    } finally {
      setBusy('idle');
    }
  };

  // ---------------------------------------------------------------- import
  const handlePickFile = async () => {
    setError(null);
    setNote(null);
    setStaged(null);
    setBusy('reading');
    try {
      const picked = await backupService.pickAndParse();
      // null means the user cancelled the picker, which is not an error.
      if (picked) setStaged(picked);
    } catch (err) {
      setError(toAppError(err).userMessage);
    } finally {
      setBusy('idle');
    }
  };

  const runRestore = async (mode: 'replace' | 'merge', includeUsers: boolean) => {
    if (!staged) return;
    setError(null);
    setBusy('restoring');
    try {
      const { outcome } = await backupService.restore(staged.backup, mode, { includeUsers });

      // The restored data has nothing to do with the cart or cached reports
      // that were on screen a moment ago.
      clearCart();
      reportService.invalidate();
      await reloadSettings();

      const parts = [
        `${outcome.products} product${outcome.products === 1 ? '' : 's'}`,
        `${outcome.invoices} bill${outcome.invoices === 1 ? '' : 's'}`,
      ];
      if (outcome.users > 0) parts.push(`${outcome.users} account${outcome.users === 1 ? '' : 's'}`);

      setStaged(null);
      setNote({
        ok: true,
        text:
          `Restored ${parts.join(', ')}.` +
          (outcome.skipped.length > 0 ? ` Skipped: ${outcome.skipped.join('; ')}.` : ''),
      });

      // Replacing the user table invalidates the current session.
      if (mode === 'replace' && includeUsers) {
        Alert.alert(
          'Accounts were replaced',
          'Sign in again with an account from the backup.',
          [{ text: 'OK', onPress: () => void signOut() }],
        );
      }
    } catch (err) {
      setError(toAppError(err).userMessage);
    } finally {
      setBusy('idle');
    }
  };

  const confirmReplace = () => {
    if (!staged) return;
    Alert.alert(
      'Replace everything?',
      `This permanently deletes the ${'products and bills'} currently on this device and replaces them with the backup. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => void runRestore('replace', staged.backup.data.users.length > 0),
        },
      ],
    );
  };

  const confirmMerge = () => {
    if (!staged) return;
    Alert.alert(
      'Add to current data?',
      'Products with the same barcode are updated. Bills already on this device are kept as they are — nothing is deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', onPress: () => void runRestore('merge', false) },
      ],
    );
  };

  const summaryRow = (label: string, value: string) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 5 }}>
      <Txt color="muted">{label}</Txt>
      <Txt style={{ fontWeight: '600' }}>{value}</Txt>
    </Row>
  );

  return (
    <Screen scroll>
      {error ? (
        <>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      {note ? (
        <>
          <Card style={{ backgroundColor: theme.colors.surfaceAlt }}>
            <Row gap={8}>
              <Ionicons
                name={note.ok ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={note.ok ? theme.colors.success : theme.colors.warning}
              />
              <Txt variant="label" color={note.ok ? 'success' : 'warning'} style={{ flex: 1 }}>
                {note.text}
              </Txt>
            </Row>
          </Card>
          <Spacer size={theme.spacing.md} />
        </>
      ) : null}

      {/* ------------------------------ Export ------------------------------ */}
      <Card variant="surface" radiusSize="xl">
        <Row gap={theme.spacing.md}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.colors.pastelGreen,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={theme.colors.pastelGreenText} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" style={{ fontSize: 17 }}>
              Export a backup
            </Txt>
            <Txt variant="caption" color="muted">
              Saves every product, bill and setting to one file you can keep safe.
            </Txt>
          </View>
        </Row>

        <Spacer size={theme.spacing.lg} />

        <Button
          title="Export all data"
          icon="download-outline"
          size="large"
          onPress={handleExport}
          loading={busy === 'exporting'}
          disabled={!idle}
        />

        <Spacer size={theme.spacing.md} />

        <Row gap={6}>
          <Ionicons name="lock-closed-outline" size={13} color={theme.colors.textMuted} />
          <Txt variant="caption" color="muted" style={{ flex: 1 }}>
            The file includes your staff accounts, so keep it private. Product photos are not
            included — only their details.
          </Txt>
        </Row>
      </Card>

      <Spacer size={theme.spacing.lg} />

      {/* ------------------------------ Import ------------------------------ */}
      <Card variant="surface" radiusSize="xl">
        <Row gap={theme.spacing.md}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              backgroundColor: theme.colors.pastelBlue,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="cloud-download-outline" size={20} color={theme.colors.pastelBlueText} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="heading" style={{ fontSize: 17 }}>
              Import a backup
            </Txt>
            <Txt variant="caption" color="muted">
              Pick a backup file. You will see what is inside before anything changes.
            </Txt>
          </View>
        </Row>

        <Spacer size={theme.spacing.lg} />

        <Button
          title={staged ? 'Choose a different file' : 'Choose backup file'}
          icon="folder-open-outline"
          variant={staged ? 'secondary' : 'primary'}
          size="large"
          onPress={handlePickFile}
          loading={busy === 'reading'}
          disabled={!idle}
        />

        {/* Nothing is written until a mode is chosen below. */}
        {staged ? (
          <>
            <Spacer size={theme.spacing.lg} />
            <Divider />
            <Spacer size={theme.spacing.md} />

            <Txt variant="label">This backup contains</Txt>
            <Spacer size={theme.spacing.sm} />

            {summaryRow('Products', String(staged.summary.products))}
            {summaryRow('Bills', String(staged.summary.invoices))}
            {summaryRow('Bill lines', String(staged.summary.invoiceItems))}
            {summaryRow('Accounts', String(staged.summary.users))}
            {summaryRow('Created', formatDateTime(staged.summary.exportedAt))}
            {staged.summary.shop ? summaryRow('Shop', staged.summary.shop) : null}

            <Spacer size={theme.spacing.lg} />

            <Button
              title="Merge into current data"
              icon="git-merge-outline"
              onPress={confirmMerge}
              loading={busy === 'restoring'}
              disabled={!idle}
            />
            <Spacer size={theme.spacing.xs} />
            <Txt variant="caption" color="muted" align="center">
              Keeps what is here. Nothing is deleted.
            </Txt>

            <Spacer size={theme.spacing.md} />

            <Button
              title="Replace everything"
              icon="warning-outline"
              variant="danger"
              onPress={confirmReplace}
              disabled={!idle}
            />
            <Spacer size={theme.spacing.xs} />
            <Txt variant="caption" color="muted" align="center">
              Deletes current products and bills first.
            </Txt>
          </>
        ) : null}
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card style={{ backgroundColor: theme.colors.surfaceAlt }}>
        <Txt variant="label">Good practice</Txt>
        <Spacer size={theme.spacing.sm} />
        <Txt variant="caption" color="muted">
          Export at the end of each week and keep the file somewhere off the phone — a lost or
          broken device takes the shop&apos;s history with it, because QuickBill stores everything
          locally and never uploads anything.
        </Txt>
      </Card>

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}
