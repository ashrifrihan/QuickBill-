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
                  isFocused ? { backgroundColor: activeSquareBg } : styles.inactiveIconSquare,
                  isScan && !isFocused && styles.scanButtonInactive,
                  isScan && isFocused && { backgroundColor: activeSquareBg },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={isScan ? 22 : 20}
                  color={isFocused ? activeIconColor : '#9CA3AF'}
                />

                {/* Unfinished sale badge indicator on Bills icon */}
                {isBills && cartCount > 0 ? (
                  <View style={styles.badgeDot}>
                    <Text style={styles.badgeText}>{cartCount}</Text>
                  </View>
                ) : null}
              </View>
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
    // Exactly half the height, so it is a true capsule at every screen size.
    // A fixed 20 on a 64pt bar rendered as a rounded *square*, which is what
    // made the bar look inconsistent.
    borderRadius: 32,
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
    // Square dimensions + half-radius = a real circle. Previously 48×42 with
    // radius 14, which is a rounded rectangle and read as a square.
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconSquare: {
    backgroundColor: '#FFFFFF',
  },
  inactiveIconSquare: {
    backgroundColor: 'transparent',
  },
  scanButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  scanButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  badgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
