/**
 * Offline login (guide §8.1). Social sign-in is deliberately Phase 3 — it
 * needs internet and provider setup, and the MVP must not depend on either.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuthStore } from '../../../store/authStore';
import { useTheme, useResponsive } from '../../hooks/useResponsive';
import { Button, Card, ErrorBanner, Field, Screen, Spacer, Txt } from '../../components/common';

export function LoginScreen() {
  const theme = useTheme();
  const { isTablet } = useResponsive();

  const signIn = useAuthStore((s) => s.signIn);
  const signingIn = useAuthStore((s) => s.signingIn);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

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
        {/* Constrained width so the form doesn't stretch across a tablet. */}
        <View style={{ width: '100%', maxWidth: isTablet ? 460 : undefined, alignSelf: 'center' }}>
          <View style={{ alignItems: 'center' }}>
            <Txt variant="display">🧾</Txt>
            <Spacer size={theme.spacing.sm} />
            <Txt variant="display">QuickBill</Txt>
            <Spacer size={theme.spacing.xs} />
            <Txt color="muted">Sign in to open the till</Txt>
          </View>

          <Spacer size={theme.spacing.xl} />

          <Card>
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
              size="large"
              onPress={handleSubmit}
              loading={signingIn}
              disabled={signingIn}
            />
          </Card>

          <Spacer size={theme.spacing.lg} />
          <Txt variant="caption" color="muted" align="center">
            Works fully offline. Your data stays on this device.
          </Txt>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
