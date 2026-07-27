/**
 * First launch: create the shop's admin account and name the shop.
 * Shown only while the users table is empty.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useAuthStore } from '../../../store/authStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTheme, useResponsive } from '../../hooks/useResponsive';
import { Button, Card, ErrorBanner, Field, Screen, Spacer, Txt } from '../../components/common';
import { MIN_PASSWORD_LENGTH } from '../../../data/repositories/SqliteUserRepository';

export function SetupScreen() {
  const theme = useTheme();
  const { isTablet } = useResponsive();

  const createFirstAdmin = useAuthStore((s) => s.createFirstAdmin);
  const signingIn = useAuthStore((s) => s.signingIn);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const saveSettings = useSettingsStore((s) => s.save);

  const [shopName, setShopName] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);

  const errors = {
    name: touched && !name.trim() ? 'Enter your name.' : undefined,
    username:
      touched && username.trim().length < 3 ? 'Username needs at least 3 characters.' : undefined,
    password:
      touched && password.length < MIN_PASSWORD_LENGTH
        ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
        : undefined,
    confirm: touched && password !== confirm ? 'Passwords do not match.' : undefined,
  };

  const isValid =
    name.trim() !== '' &&
    username.trim().length >= 3 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirm;

  const handleSubmit = async () => {
    setTouched(true);
    if (!isValid) return;

    const created = await createFirstAdmin({ username, name, password });
    // Only save the shop name once the account exists, so a failed signup
    // doesn't leave half-applied settings behind.
    if (created && shopName.trim()) {
      await saveSettings({ shopName: shopName.trim() }).catch(() => {});
    }
  };

  return (
    <Screen scroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ width: '100%', maxWidth: isTablet ? 500 : undefined, alignSelf: 'center' }}>
          <Txt variant="display">Welcome to QuickBill</Txt>
          <Spacer size={theme.spacing.xs} />
          <Txt color="muted">
            Create the owner account for this device. Everything works offline from here on.
          </Txt>

          <Spacer size={theme.spacing.xl} />

          <Card>
            {error ? (
              <>
                <ErrorBanner message={error} onDismiss={clearError} />
                <Spacer size={theme.spacing.md} />
              </>
            ) : null}

            <Field
              label="Shop name"
              value={shopName}
              onChangeText={setShopName}
              placeholder="My Grocery"
              hint="Printed at the top of every bill. You can change it later."
            />
            <Spacer size={theme.spacing.md} />

            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="Nimal Perera"
              error={errors.name}
            />
            <Spacer size={theme.spacing.md} />

            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="admin"
              error={errors.username}
            />
            <Spacer size={theme.spacing.md} />

            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
            />
            <Spacer size={theme.spacing.md} />

            <Field
              label="Confirm password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              error={errors.confirm}
              onSubmitEditing={handleSubmit}
            />

            <Spacer size={theme.spacing.lg} />

            <Button
              title="Create account & start"
              size="large"
              onPress={handleSubmit}
              loading={signingIn}
              disabled={signingIn}
            />
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
