import React from 'react';
import Constants from 'expo-constants';
import { useTheme } from '../../hooks/useResponsive';
import { Card, Divider, Row, Screen, Spacer, Txt } from '../../components/common';

export function AboutScreen() {
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const row = (label: string, value: string) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
      <Txt color="muted">{label}</Txt>
      <Txt>{value}</Txt>
    </Row>
  );

  return (
    <Screen scroll>
      <Card>
        <Txt variant="display" align="center">
          🧾
        </Txt>
        <Spacer size={theme.spacing.sm} />
        <Txt variant="title" align="center">
          QuickBill
        </Txt>
        <Spacer size={theme.spacing.xs} />
        <Txt color="muted" align="center">
          Barcode scanning &amp; billing for small shops
        </Txt>
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        {row('Version', version)}
        <Divider />
        {row('Storage', 'On-device SQLite')}
        <Divider />
        {row('Works offline', 'Always')}
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Your data</Txt>
        <Spacer size={theme.spacing.sm} />
        <Txt variant="caption" color="muted">
          Every product, bill and setting lives in a database on this device. Nothing is uploaded
          anywhere, and the whole app — scanning, billing, printing to PDF — works with the internet
          switched off. The camera is used only to read barcodes; no images are stored.
        </Txt>
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Txt variant="heading">Built with</Txt>
        <Spacer size={theme.spacing.sm} />
        <Txt variant="caption" color="muted">
          Expo · React Native · TypeScript · expo-sqlite · expo-camera · expo-print · React
          Navigation · Zustand · Zod. All free and open source.
        </Txt>
      </Card>

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}
