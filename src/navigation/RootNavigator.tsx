/**
 * Top-level routing (guide §11).
 *
 * Three states, decided once at startup:
 *   no account yet → Setup
 *   signed out      → Login
 *   signed in       → the tabbed app
 *
 * Cart / Checkout / Receipt sit at this level, not inside a tab, so they can
 * be pushed from the scanner, the product list or the dashboard alike.
 */

import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../ui/hooks/useResponsive';
import { ErrorBoundary } from '../ui/components/ErrorBoundary';
import { LoginScreen } from '../ui/screens/auth/LoginScreen';
import { SetupScreen } from '../ui/screens/auth/SetupScreen';
import { CartScreen } from '../ui/screens/CartScreen';
import { CheckoutScreen } from '../ui/screens/CheckoutScreen';
import { ReceiptScreen } from '../ui/screens/ReceiptScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Hoisted to module scope for the same reason as in MainTabs: a component
 * identity created during render remounts the screen on every re-render.
 */
function guarded<P extends object>(Component: React.ComponentType<P>, label: string) {
  return function Guarded(props: P) {
    return (
      <ErrorBoundary label={label}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

const GuardedCart = guarded(CartScreen, 'cart');
const GuardedCheckout = guarded(CheckoutScreen, 'checkout');
const GuardedReceipt = guarded(ReceiptScreen, 'receipt');

function Splash() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const initialising = useAuthStore((s) => s.initialising);
  const needsSetup = useAuthStore((s) => s.needsSetup);

  const navTheme = {
    ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.mode === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.text,
      border: theme.colors.border,
      primary: theme.colors.primary,
    },
  };

  if (initialising) return <Splash />;

  const headerOptions = {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.text,
    contentStyle: { backgroundColor: theme.colors.background },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user === null ? (
          <Stack.Screen
            name={needsSetup ? 'Setup' : 'Login'}
            component={needsSetup ? SetupScreen : LoginScreen}
          />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Cart"
              component={GuardedCart}
              options={{ headerShown: true, title: 'Current bill', ...headerOptions }}
            />
            <Stack.Screen
              name="Checkout"
              component={GuardedCheckout}
              options={{ headerShown: true, title: 'Checkout', ...headerOptions }}
            />
            <Stack.Screen
              name="Receipt"
              component={GuardedReceipt}
              options={{
                headerShown: true,
                title: 'Bill',
                // No swipe-back off a just-completed sale.
                gestureEnabled: false,
                ...headerOptions,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
