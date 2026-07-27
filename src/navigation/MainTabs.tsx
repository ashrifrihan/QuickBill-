/**
 * Bottom tabs with a prominent centre Scan button and floating dark navigation bar
 * with rounded-square radius tab buttons for Home, Products, Scan, History & Profile (guide §11).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
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
    headerShadowVisible: false,
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
        options={{ headerShown: false }}
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
        options={{ headerShown: false }}
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

/** Floating Dark Capsule Bottom Navigation Bar (All tabs use rounded-square radius) */
function FloatingCapsuleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cartCount = useCartStore((s) => s.cart.items.length);

  type TabIconName = React.ComponentProps<typeof Ionicons>['name'];
  const tabIcons: Record<string, { outline: TabIconName; filled: TabIconName }> = {
    HomeTab: { outline: 'grid-outline', filled: 'grid' },
    ProductsTab: { outline: 'cube-outline', filled: 'cube' },
    ScanTab: { outline: 'scan-outline', filled: 'scan' },
    BillsTab: { outline: 'receipt-outline', filled: 'receipt' },
    MoreTab: { outline: 'person-outline', filled: 'person' },
  };

  const bottomMargin = Math.max(insets.bottom, 12);

  return (
    <View style={[styles.floatingContainer, { bottom: bottomMargin }]} pointerEvents="box-none">
      <View
        style={[
          styles.capsule,
          {
            backgroundColor: theme.colors.darkCapsule,
          },
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconConfig = tabIcons[route.name] ?? { outline: 'apps-outline', filled: 'apps' };
          const iconName = isFocused ? iconConfig.filled : iconConfig.outline;
          const isScan = route.name === 'ScanTab';
          const isBills = route.name === 'BillsTab';

          const isDark = theme.mode === 'dark';
          const activeSquareBg = isDark ? 'rgba(255, 255, 255, 0.2)' : '#FFFFFF';
          const activeIconColor = isDark ? '#FFFFFF' : '#16171D';

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              style={styles.tabItem}
            >
              <View
                style={[
                  styles.iconSquare,
                  isFocused
                    ? { backgroundColor: activeSquareBg }
                    : isScan
                      ? styles.scanButtonInactive
                      : styles.inactiveIconSquare,
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={isScan ? 22 : 20}
                  color={isFocused ? activeIconColor : '#9CA3AF'}
                />
              </View>

              {/*
                The badge sits OUTSIDE the circle. Inside it, the round
                `overflow: hidden` clips anything in the corner — which is
                exactly where a top-right badge lives.
              */}
              {isBills && cartCount > 0 ? (
                <View style={styles.badgeDot} pointerEvents="none">
                  <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingCapsuleTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeNavigator} />
      <Tab.Screen name="ProductsTab" component={ProductsNavigator} />
      <Tab.Screen name="ScanTab" component={GuardedScan} />
      <Tab.Screen name="BillsTab" component={BillsNavigator} />
      <Tab.Screen name="MoreTab" component={MoreNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Same reasoning as the icon circles: 999 lets RN clamp to half the
    // measured height, so it stays a true capsule even if the bar's height
    // ever changes. A hardcoded 20 rendered as a rounded square.
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 9,
    width: '100%',
    maxWidth: 440,
    // 46pt icon + 9pt padding top and bottom fits exactly, so nothing overflows
    // and the cart badge is never clipped.
    height: 64,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSquare: {
    width: 46,
    height: 46,
    // 999, not 23. React Native clamps borderRadius to half the SMALLER
    // measured side, so this is a perfect circle at whatever size the box
    // actually ends up. A hardcoded 23 only looks circular while the box is
    // exactly 46×46 — the moment flex compresses it (narrow screens, font
    // scaling, a stale measurement) it renders as a rounded square, which is
    // the inconsistency that kept showing up.
    borderRadius: 999,
    // Belt and braces: never let flex squash or stretch it out of square.
    aspectRatio: 1,
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  inactiveIconSquare: {
    backgroundColor: 'transparent',
  },
  scanButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  badgeDot: {
    // Positioned against the tab item, not the icon circle, so the round
    // clip can't cut it off.
    position: 'absolute',
    top: 0,
    right: 6,
    backgroundColor: '#EF4444',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    // Separates the badge from the dark bar behind it.
    borderWidth: 2,
    borderColor: '#16171D',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
