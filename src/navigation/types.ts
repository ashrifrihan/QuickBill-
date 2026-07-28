import { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Route params. Checkout lives at the ROOT rather than inside a tab, because
 * the cart must be reachable from the scanner, the product list and the
 * dashboard alike.
 */

export type ProductsStackParamList = {
  ProductList: { lowStockOnly?: boolean } | undefined;
  ProductDetail: { productId: number };
  ProductForm: { productId?: number; barcode?: string } | undefined;
};

export type HomeStackParamList = {
  Dashboard: undefined;
  Reports: undefined;
};

export type BillsStackParamList = {
  BillHistory: undefined;
  BillDetail: { invoiceId: number };
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Settings: undefined;
  PrinterSettings: undefined;
  Backup: undefined;
  About: undefined;
};

export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  ProductsTab: NavigatorScreenParams<ProductsStackParamList>;
  ScanTab: undefined;
  BillsTab: NavigatorScreenParams<BillsStackParamList>;
  MoreTab: NavigatorScreenParams<MoreStackParamList>;
};

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Setup: undefined;
  Main: NavigatorScreenParams<MainTabParamList>;
  Cart: undefined;
  Checkout: undefined;
  Receipt: { invoiceId: number; justCreated?: boolean };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
