/** The "More" / Profile tab: profile, settings, printer, about (guide §11). */

import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore, useIsAdmin } from '../../../store/authStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTheme } from '../../hooks/useResponsive';
import { Badge, BentoCard, Card, Divider, Row, Screen, Spacer, Txt, IconName } from '../../components/common';
import type { MoreStackParamList } from '../../../navigation/types';

type Nav = NativeStackNavigationProp<MoreStackParamList>;

export function MoreScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const isAdmin = useIsAdmin();
  const settings = useSettingsStore((s) => s.settings);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'Any unfinished bill is saved and will still be here.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const item = (
    icon: IconName,
    label: string,
    hint: string,
    onPress: () => void,
    adminOnly = false,
  ) => {
    if (adminOnly && !isAdmin) return null;
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, paddingVertical: 14 })}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={theme.spacing.md} style={{ flex: 1 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: theme.colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={icon} size={20} color={theme.colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="label" style={{ fontSize: 15, fontWeight: '700' }}>
                {label}
              </Txt>
              <Txt variant="caption" color="muted">
                {hint}
              </Txt>
            </View>
          </Row>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Row>
      </Pressable>
    );
  };

  const avatarInitials = (user?.name ?? 'SB').substring(0, 2).toUpperCase();

  return (
    <Screen scroll>
      {/* Title */}
      <Txt variant="title" style={{ fontSize: 28, fontWeight: '700', marginBottom: theme.spacing.md }}>
        Profile & Settings
      </Txt>

      {/* User Profile Card (Matching uploaded profile design) */}
      <Card variant="surface" radiusSize="xl">
        <Row gap={theme.spacing.lg}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: theme.colors.pastelPurple,
              borderWidth: 1.5,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Txt style={{ fontSize: 24, fontWeight: '700', color: theme.colors.pastelPurpleText }}>
              {avatarInitials}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Txt variant="heading" style={{ fontSize: 20, fontWeight: '700' }}>
                {user?.name ?? 'Cashier'}
              </Txt>
              {user ? <Badge label={user.role.toUpperCase()} tone={isAdmin ? 'purple' : 'neutral'} /> : null}
            </Row>
            <Spacer size={2} />
            <Txt variant="caption" color="muted">
              @{user?.username ?? 'cashier'} · {settings.shopName}
            </Txt>
          </View>
        </Row>
      </Card>

      <Spacer size={theme.spacing.lg} />

      {/* Metric Soft Pastel Pills (Matching weight/goal cards from uploaded profile screen) */}
      <Row gap={theme.spacing.sm}>
        <View style={{ flex: 1 }}>
          <BentoCard
            title={settings.currency}
            subtitle="Currency"
            tagLabel="STORE"
            tagTone="green"
            variant="green"
          />
        </View>
        <View style={{ flex: 1 }}>
          <BentoCard
            title={`${settings.taxRate}%`}
            subtitle="Tax Rate"
            tagLabel="TAX"
            tagTone="blue"
            variant="blue"
          />
        </View>
        <View style={{ flex: 1 }}>
          <BentoCard
            title={`${settings.lowStockThreshold}`}
            subtitle="Low Stock Alert"
            tagLabel="ALERT"
            tagTone="yellow"
            variant="yellow"
          />
        </View>
      </Row>

      <Spacer size={theme.spacing.lg} />

      {/* Settings Navigation Options List */}
      <Card variant="surface" radiusSize="xl" style={{ paddingHorizontal: theme.spacing.lg }}>
        {item('storefront-outline', 'Shop settings', 'Name, currency, tax & low-stock alert', () =>
          navigation.navigate('Settings'),
          true,
        )}
        {isAdmin ? <Divider /> : null}
        {item('print-outline', 'Printer Strategy', `Currently: ${settings.printerStrategy === 'pdf' ? 'PDF / Share' : 'Bluetooth'}`, () =>
          navigation.navigate('PrinterSettings'),
        )}
        <Divider />
        {item('save-outline', 'Backup & restore', 'Export all data, or import from a backup file', () =>
          navigation.navigate('Backup'),
          true,
        )}
        <Divider />
        {item('information-circle-outline', 'About QuickBill', 'App version and architecture notes', () => navigation.navigate('About'))}
      </Card>

      <Spacer size={theme.spacing.lg} />

      {/* Dark Mode Switch Card */}
      <Card variant="surface" radiusSize="xl">
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={theme.spacing.md}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: theme.colors.pastelPurple,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="moon-outline" size={20} color={theme.colors.pastelPurpleText} />
            </View>
            <View>
              <Txt variant="label" style={{ fontSize: 15, fontWeight: '700' }}>
                Dark Mode
              </Txt>
              <Txt variant="caption" color="muted">
                Comfortable theme for dim store environments
              </Txt>
            </View>
          </Row>
          <Pressable
            onPress={() => void setThemeMode(settings.themeMode === 'dark' ? 'light' : 'dark')}
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.themeMode === 'dark' }}
            accessibilityLabel="Dark mode"
            style={{
              width: 56,
              height: 32,
              borderRadius: 16,
              padding: 3,
              backgroundColor:
                settings.themeMode === 'dark' ? theme.colors.pastelPurpleText : theme.colors.border,
              justifyContent: 'center',
              alignItems: settings.themeMode === 'dark' ? 'flex-end' : 'flex-start',
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: theme.colors.surface,
              }}
            />
          </Pressable>
        </Row>
      </Card>

      <Spacer size={theme.spacing.lg} />

      {/* Sign Out Action Button */}
      <Pressable
        onPress={handleSignOut}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Card variant="pink" radiusSize="xl">
          <Row style={{ justifyContent: 'center' }} gap={theme.spacing.sm}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.pastelPinkText} />
            <Txt variant="label" style={{ color: theme.colors.pastelPinkText, fontSize: 16, fontWeight: '700' }}>
              Sign Out of Till
            </Txt>
          </Row>
        </Card>
      </Pressable>

      <Spacer size={theme.spacing.lg} />

      <View style={{ alignItems: 'center' }}>
        <Txt variant="caption" color="muted" style={{ fontWeight: '600' }}>
          QuickBill POS · Powered by Nexzoa
        </Txt>
      </View>

      <Spacer size={theme.spacing.xxl} />
    </Screen>
  );
}
