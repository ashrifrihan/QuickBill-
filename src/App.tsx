/**
 * App entry.
 *
 * Startup order matters: global error handlers first (so anything that fails
 * below is captured), then the database and its migrations, then settings,
 * auth state and the recovered cart draft.
 *
 * If the database itself cannot open there is no usable app, so that is the
 * one failure with its own blocking screen — everything else degrades to a
 * default and lets the till open.
 */

import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { RootNavigator } from './navigation/RootNavigator';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { Button, Screen, Spacer, Txt } from './ui/components/common';
import { getDatabase } from './data/database';
import { useSettingsStore } from './store/settingsStore';
import { useAuthStore } from './store/authStore';
import { useCartStore } from './store/cartStore';
import { installGlobalErrorHandlers } from './errors/globalHandlers';
import { logger } from './errors/logger';
import { toAppError } from './errors/AppError';
import { defaultTheme } from './config/theme';

type BootState = 'loading' | 'ready' | 'failed';

export default function App() {
  const [boot, setBoot] = useState<BootState>('loading');
  const [bootError, setBootError] = useState<string | null>(null);

  const loadSettings = useSettingsStore((s) => s.load);
  const bootstrapAuth = useAuthStore((s) => s.bootstrap);
  const restoreDraft = useCartStore((s) => s.restoreDraft);

  const start = React.useCallback(async () => {
    setBoot('loading');
    setBootError(null);
    try {
      installGlobalErrorHandlers();

      // Opens the connection and runs migrations. Everything else depends on it.
      await getDatabase();

      // Independent, and none of them is fatal: settings fall back to defaults,
      // auth falls back to the login screen, a bad draft is discarded.
      // `allSettled`, not `all` — one of them failing must not stop the till
      // from opening, which is what `all` did.
      const results = await Promise.allSettled([loadSettings(), bootstrapAuth(), restoreDraft()]);
      const labels = ['settings', 'auth', 'cart draft'];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`Startup step "${labels[index]}" failed; continuing`, result.reason);
        }
      });

      logger.info('QuickBill started');
      setBoot('ready');
    } catch (error) {
      logger.error('Startup failed', error);
      setBootError(toAppError(error).userMessage);
      setBoot('failed');
    }
  }, [loadSettings, bootstrapAuth, restoreDraft]);

  useEffect(() => {
    void start();
  }, [start]);

  if (boot === 'loading') {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: defaultTheme.colors.background }} />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  if (boot === 'failed') {
    return (
      <SafeAreaProvider>
        <Screen scroll contentStyle={{ flexGrow: 1, justifyContent: 'center' }}>
          <Txt variant="display" align="center">
            ⚠️
          </Txt>
          <Spacer size={16} />
          <Txt variant="title" align="center">
            QuickBill couldn't start
          </Txt>
          <Spacer size={8} />
          <Txt color="muted" align="center">
            {bootError ?? 'The local database could not be opened.'}
          </Txt>
          <Spacer size={24} />
          <Button title="Try again" onPress={() => void start()} />
        </Screen>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Outermost boundary — the last thing between a crash and a blank screen. */}
        <ErrorBoundary label="app">
          <RootNavigator />
        </ErrorBoundary>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
