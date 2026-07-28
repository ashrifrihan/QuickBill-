/**
 * Offline login (guide §8.1). Social sign-in is deliberately Phase 3 — it
 * needs internet and provider setup, and the MVP must not depend on either.
 *
 * The hero is drawn in code rather than loaded as an image or GIF. This screen
 * is the first thing shown on a till that must work with the internet off, so
 * a remote asset would render as a broken box exactly when the shop is offline.
 * Everything here ships in the bundle and animates on the native thread.
 */

import React, { useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../../store/authStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTheme, useResponsive } from '../../hooks/useResponsive';
import { useEntrance, useFloat, usePopIn } from '../../hooks/useEntrance';
import { Button, Card, ErrorBanner, Field, Row, Screen, Spacer, Txt } from '../../components/common';

export function LoginScreen() {
  const theme = useTheme();
  const { isTablet } = useResponsive();
  const shopName = useSettingsStore((s) => s.settings.shopName);

  const signIn = useAuthStore((s) => s.signIn);
  const signingIn = useAuthStore((s) => s.signingIn);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  // Staggered entrance: hero, then heading, then form, then footer.
  const heroStyle = usePopIn();
  const headingStyle = useEntrance({ delay: 120 });
  const formStyle = useEntrance({ delay: 220 });
  const footerStyle = useEntrance({ delay: 320 });

  const floatSlow = useFloat({ duration: 3400 });
  const floatFast = useFloat({ duration: 2600, distance: 8, delay: 400 });

  const usernameError = touched && !username.trim() ? 'Enter your username.' : undefined;
  const passwordError = touched && !password ? 'Enter your password.' : undefined;

  const handleSubmit = async () => {
    setTouched(true);
    if (!username.trim() || !password) return;
    await signIn(username, password);
  };

  return (
    <Screen scroll contentStyle={{ justifyContent: 'center', flexGrow: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ width: '100%', maxWidth: isTablet ? 460 : undefined, alignSelf: 'center' }}>
          {/* ---------------- Animated hero ---------------- */}
          <View style={styles.heroWrap}>
            {/* Drifting decorative tiles, purely ambient. */}
            <Animated.View
              style={[
                styles.blob,
                styles.blobLeft,
                { backgroundColor: theme.colors.pastelGreen },
                floatSlow,
              ]}
            >
              <Ionicons name="pricetag" size={20} color={theme.colors.pastelGreenText} />
            </Animated.View>

            <Animated.View
              style={[
                styles.blob,
                styles.blobRight,
                { backgroundColor: theme.colors.pastelBlue },
                floatFast,
              ]}
            >
              <Ionicons name="receipt" size={20} color={theme.colors.pastelBlueText} />
            </Animated.View>

            <Animated.View
              style={[
                styles.logoMark,
                { backgroundColor: theme.colors.darkCapsule, borderRadius: 28 },
                heroStyle,
              ]}
            >
              <Ionicons name="scan" size={40} color="#FFFFFF" />
            </Animated.View>
          </View>

          <Spacer size={theme.spacing.lg} />

          <Animated.View style={[{ alignItems: 'center' }, headingStyle]}>
            <Txt variant="display" style={{ fontSize: 32, fontWeight: '700' }}>
              QuickBill
            </Txt>
            <Spacer size={theme.spacing.xs} />
            <Txt color="muted" align="center">
              {shopName ? `Sign in to ${shopName}` : 'Sign in to open the till'}
            </Txt>

            <Spacer size={theme.spacing.lg} />

            {/* Three things worth knowing before the first login. */}
            <Row gap={theme.spacing.sm} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
              <FeaturePill icon="cloud-offline-outline" label="Works offline" tone="green" />
              <FeaturePill icon="flash-outline" label="Scan & bill fast" tone="yellow" />
              <FeaturePill icon="lock-closed-outline" label="Stays on device" tone="purple" />
            </Row>
          </Animated.View>

          <Spacer size={theme.spacing.xl} />

          {/* ---------------- Form ---------------- */}
          <Animated.View style={formStyle}>
            <Card variant="surface" radiusSize="xl">
              {error ? (
                <>
                  <ErrorBanner message={error} onDismiss={clearError} />
                  <Spacer size={theme.spacing.md} />
                </>
              ) : null}

              <Field
                label="Username"
                value={username}
                onChangeText={setUsername}
                icon="person-outline"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                placeholder="admin"
                returnKeyType="next"
                error={usernameError}
              />

              <Spacer size={theme.spacing.md} />

              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                icon="key-outline"
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                placeholder="••••••"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                error={passwordError}
                rightElement={
                  <Pressable
                    onPress={() => setShowPassword((prev) => !prev)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    style={{ padding: 4, justifyContent: 'center', alignItems: 'center' }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.colors.textMuted}
                    />
                  </Pressable>
                }
              />

              <Spacer size={theme.spacing.lg} />

              <Button
                title="Sign in"
                icon="arrow-forward"
                size="large"
                onPress={handleSubmit}
                loading={signingIn}
                disabled={signingIn}
              />
            </Card>
          </Animated.View>

          <Spacer size={theme.spacing.lg} />

          <Animated.View style={footerStyle}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Row gap={6} style={{ justifyContent: 'center' }}>
                <Ionicons name="shield-checkmark-outline" size={14} color={theme.colors.textMuted} />
                <Txt variant="caption" color="muted">
                  Every sale is stored on this device only
                </Txt>
              </Row>
              <Txt variant="caption" color="muted" style={{ opacity: 0.7, fontSize: 11, fontWeight: '600' }}>
                Powered by Nexzoa
              </Txt>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FeaturePill({
  icon,
  label,
  tone,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tone: 'green' | 'yellow' | 'purple';
}) {
  const theme = useTheme();
  const palette = {
    green: { bg: theme.colors.pastelGreen, fg: theme.colors.pastelGreenText },
    yellow: { bg: theme.colors.pastelYellow, fg: theme.colors.pastelYellowText },
    purple: { bg: theme.colors.pastelPurple, fg: theme.colors.pastelPurpleText },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Ionicons name={icon} size={13} color={palette.fg} />
      <Txt style={{ fontSize: 12, fontWeight: '700', color: palette.fg }}>{label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  heroWrap: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blobLeft: { left: '18%', top: 14 },
  blobRight: { right: '18%', bottom: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
  },
});
