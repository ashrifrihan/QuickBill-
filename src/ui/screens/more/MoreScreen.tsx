/** The "More" tab: profile, settings, printer, about (guide §11). */

import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useIsAdmin } from '../../../store/authStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTheme } from '../../hooks/useResponsive';
import { Badge, Card, Divider, Row, Screen, Spacer, Txt } from '../../components/common';
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

  const item = (label: string, hint: string, onPress: () => void, adminOnly = false) => {
    // Admin-only rows are hidden rather than shown-and-disabled (guide §11).
    if (adminOnly && !isAdmin) return null;
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 14 })}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt variant="label">{label}</Txt>
            <Txt variant="caption" color="muted">
              {hint}
            </Txt>
          </View>
          <Txt color="muted">›</Txt>
        </Row>
      </Pressable>
    );
  };

  return (
    <Screen scroll>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="heading">{user?.name ?? 'Not signed in'}</Txt>
            <Spacer size={2} />
            <Txt variant="caption" color="muted">
              @{user?.username ?? '—'}
            </Txt>
          </View>
          {user ? <Badge label={user.role} tone={isAdmin ? 'primary' : 'neutral'} /> : null}
        </Row>
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
        {item('Shop settings', 'Name, currency, tax, low-stock alert', () =>
          navigation.navigate('Settings'),
          true,
        )}
        {isAdmin ? <Divider /> : null}
        {item('Printer', `Currently: ${settings.printerStrategy === 'pdf' ? 'PDF / share' : 'Bluetooth'}`, () =>
          navigation.navigate('PrinterSettings'),
        )}
        <Divider />
        {item('About QuickBill', 'Version and credits', () => navigation.navigate('About'))}
      </Card>

      <Spacer size={theme.spacing.lg} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Txt variant="label">Dark mode</Txt>
            <Txt variant="caption" color="muted">
              Easier on the eyes in a dim shop
            </Txt>
          </View>
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
                settings.themeMode === 'dark' ? theme.colors.primary : theme.colors.border,
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

      <Pressable
        onPress={handleSignOut}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Card>
          <Txt variant="label" color="danger" align="center">
            Sign out
          </Txt>
        </Card>
      </Pressable>

      <Spacer size={theme.spacing.xl} />
    </Screen>
  );
}
