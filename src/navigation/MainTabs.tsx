/**
 * Bottom tabs with a prominent centre Scan button (guide §11), and a stack
 * inside each tab for drill-downs.
 *
 * Every screen is wrapped in its own ErrorBoundary so one broken screen can't
 * take the whole till down (guide §9.4).
 */

import React from 'react';
import { Platform, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from '../ui/components/ErrorBoundary';
import { useTheme } from '../ui/hooks/useResponsive';
import { useCartStore } from '../store/cartStore';
import { useIsAdmin } from '../store/authStore';
import { DashboardScreen } from '../ui/screens/DashboardScreen';
import { ReportsScreen } from '../ui/screens/ReportsScreen';
import { ScanScreen } from '../ui/screens/ScanScreen';
import { ProductListScreen } from '../ui/screens/products/ProductListScreen';
import { ProductDetailScreen } from '../ui/screens/products/ProductDetailScreen';
import { ProductFormScreen } from '../ui/screens/products/ProductFormScreen';
import { BillHistoryScreen } from '../ui/screens/bills/BillHistoryScreen';
import { MoreScreen } from '../ui/screens/more/MoreScreen';
import { SettingsScreen } from '../ui/screens/more/SettingsScreen';
import { PrinterSettingsScreen } from '../ui/screens/more/PrinterSettingsScreen';
import { AboutScreen } from '../ui/screens/more/AboutScreen';
import type {
  BillsStackParamList,
  HomeStackParamList,
  MainTabParamList,
  MoreStackParamList,
  ProductsStackParamList,
} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ProductsStack = createNativeStackNavigator<ProductsStackParamList>();
const BillsStack = createNativeStackNavigator<BillsStackParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

/**
 * Wraps a screen so a render crash inside it stays contained.
 *
 * These MUST be created once at module scope, not inline in a navigator's
 * render. A fresh component identity on every render makes React treat it as a
 * different type and remount the screen, wiping its state mid-sale.
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

const GuardedDashboard = guarded(DashboardScreen, 'dashboard');
const GuardedReports = guarded(ReportsScreen, 'reports');
const GuardedScan = guarded(ScanScreen, 'scanner');
const GuardedProductList = guarded(ProductListScreen, 'product list');
const GuardedProductDetail = guarded(ProductDetailScreen, 'product details');
const GuardedProductForm = guarded(ProductFormScreen, 'product form');
const GuardedBillHistory = guarded(BillHistoryScreen, 'bill history');
const GuardedMore = guarded(MoreScreen, 'more menu');
const GuardedSettings = guarded(SettingsScreen, 'settings');
const GuardedPrinterSettings = guarded(PrinterSettingsScreen, 'printer settings');
const GuardedAbout = guarded(AboutScreen, 'about');

function useStackOptions() {
  const theme = useTheme();
  return {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.text,
    headerTitleStyle: { fontWeight: '700' as const },
    contentStyle: { backgroundColor: theme.colors.background },
  };
}

function HomeNavigator() {
  const options = useStackOptions();
  return (
    <HomeStack.Navigator screenOptions={options}>
      <HomeStack.Screen
        name="Dashboard"
        component={GuardedDashboard}
        options={{ title: 'QuickBill' }}
      />
      <HomeStack.Screen
        name="Reports"
        component={GuardedReports}
        options={{ title: 'Reports' }}
      />
    </HomeStack.Navigator>
  );
}

function ProductsNavigator() {
  const options = useStackOptions();
  return (
    <ProductsStack.Navigator screenOptions={options}>
      <ProductsStack.Screen
        name="ProductList"
        component={GuardedProductList}
        options={{ title: 'Products' }}
      />
      <ProductsStack.Screen
        name="ProductDetail"
        component={GuardedProductDetail}
        options={{ title: 'Product' }}
      />
      <ProductsStack.Screen
        name="ProductForm"
        component={GuardedProductForm}
        options={({ route }) => ({
          title: route.params?.productId ? 'Edit product' : 'Add product',
        })}
      />
    </ProductsStack.Navigator>
  );
}

function BillsNavigator() {
  const options = useStackOptions();
  return (
    <BillsStack.Navigator screenOptions={options}>
      <BillsStack.Screen
        name="BillHistory"
        component={GuardedBillHistory}
        options={{ title: 'Bills' }}
      />
    </BillsStack.Navigator>
  );
}

function MoreNavigator() {
  const options = useStackOptions();
  return (
    <MoreStack.Navigator screenOptions={options}>
      <MoreStack.Screen
        name="MoreMenu"
        component={GuardedMore}
        options={{ title: 'More' }}
      />
      <MoreStack.Screen
        name="Settings"
        component={GuardedSettings}
        options={{ title: 'Shop settings' }}
      />
      <MoreStack.Screen
        name="PrinterSettings"
        component={GuardedPrinterSettings}
        options={{ title: 'Printer' }}
      />
      <MoreStack.Screen
        name="About"
        component={GuardedAbout}
        options={{ title: 'About' }}
      />
    </MoreStack.Navigator>
  );
}

function TabIcon({ icon, focused, color }: { icon: string; focused: boolean; color: string }) {
  return <Text style={{ fontSize: focused ? 24 : 21, color }}>{icon}</Text>;
}

export function MainTabs() {
  const theme = useTheme();
  const isAdmin = useIsAdmin();
  const cartCount = useCartStore((s) => s.cart.items.length);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeNavigator}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="🏠" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProductsTab"
        component={ProductsNavigator}
        options={{
          title: 'Products',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="📦" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ScanTab"
        component={GuardedScan}
        options={{
          title: 'Scan',
          // Raised centre button — the action the app exists for.
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                marginTop: -22,
                backgroundColor: theme.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
                elevation: 6,
              }}
            >
              <Text style={{ fontSize: focused ? 27 : 25 }}>📷</Text>
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="BillsTab"
        component={BillsNavigator}
        options={{
          title: 'Bills',
          // Badge shows an unfinished sale from anywhere in the app.
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="🧾" focused={focused} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreNavigator}
        options={{
          title: isAdmin ? 'More' : 'Account',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icon="⚙️" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
