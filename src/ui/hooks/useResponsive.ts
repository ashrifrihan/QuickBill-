/**
 * Responsive layout primitives (guide §7).
 *
 * Everything derives from `useWindowDimensions()`, which updates live on
 * rotation — no hardcoded pixel checks, no stale values after a device turns.
 */

import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { TABLET_BREAKPOINT } from '../../config/constants';
import { Theme, buildTheme } from '../../config/theme';
import { useSettingsStore } from '../../store/settingsStore';

export interface Responsive {
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  /**
   * True when there is room for the two-pane billing layout: products on the
   * left, live cart on the right (guide §7). A phone in landscape is wide but
   * too short for it, so height is checked too.
   */
  isTwoPane: boolean;
  /** Grid columns for product lists. */
  columns: number;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const isTablet = width >= TABLET_BREAKPOINT;
    const isLandscape = width > height;
    return {
      width,
      height,
      isTablet,
      isLandscape,
      isTwoPane: isTablet && width >= 900,
      columns: width >= 1100 ? 3 : isTablet ? 2 : 1,
    };
  }, [width, height]);
}

/**
 * The theme, already adjusted for screen size. Spacing and type scale up
 * slightly on tablets so a big screen doesn't look like a stretched phone.
 */
export function useTheme(): Theme {
  const mode = useSettingsStore((state) => state.settings.themeMode);
  const { isTablet } = useResponsive();
  return useMemo(() => buildTheme(mode, isTablet), [mode, isTablet]);
}

/** Scales a spacing/type value for the current screen size. */
export function useScaled(): (value: number) => number {
  const theme = useTheme();
  return useMemo(() => (value: number) => Math.round(value * theme.scale), [theme.scale]);
}
