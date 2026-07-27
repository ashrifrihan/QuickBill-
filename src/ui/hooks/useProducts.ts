/** Product list + search, refreshed whenever the screen comes back into focus. */

import { useCallback, useState } from 'react';
import { useAsyncOnFocus } from './useAsync';
import { productService } from '../../services/ProductService';
import { Product } from '../../domain/Product';
import { useSettingsStore } from '../../store/settingsStore';

export function useProducts(options: { onlyLowStock?: boolean } = {}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const threshold = useSettingsStore((state) => state.settings.lowStockThreshold);

  const state = useAsyncOnFocus<Product[]>(
    () =>
      productService.list({
        search: search.trim() || undefined,
        category: category ?? undefined,
        onlyLowStock: options.onlyLowStock,
        lowStockThreshold: threshold,
      }),
    [search, category, options.onlyLowStock, threshold],
    { label: 'products' },
  );

  return {
    ...state,
    products: state.data ?? [],
    search,
    setSearch,
    category,
    setCategory,
    lowStockThreshold: threshold,
    isEmpty: !state.loading && (state.data?.length ?? 0) === 0,
  };
}

export function useProductCategories() {
  const state = useAsyncOnFocus<string[]>(() => productService.categories(), [], {
    label: 'categories',
  });
  return state.data ?? [];
}

export function useProduct(id?: number) {
  const load = useCallback(
    () => (id === undefined ? Promise.resolve(null) : productService.findById(id)),
    [id],
  );
  return useAsyncOnFocus<Product | null>(load, [id], { label: 'product' });
}
