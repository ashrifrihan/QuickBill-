/**
 * Design tokens. Screens must reference these rather than magic numbers so the
 * whole app can be rescaled (e.g. nudged up on tablets) from one place.
 */

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  primary: string;
  primaryText: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
}

const lightPalette: Palette = {
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F8',
  primary: '#1E63E9',
  primaryText: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#64748B',
  border: '#DDE3EC',
  success: '#12855B',
  warning: '#B7791F',
  danger: '#C62F2F',
  overlay: 'rgba(15, 23, 42, 0.45)',
};

const darkPalette: Palette = {
  background: '#0B1120',
  surface: '#151E31',
  surfaceAlt: '#1E2940',
  primary: '#4F8BFF',
  primaryText: '#08121F',
  text: '#E8EDF6',
  textMuted: '#94A3B8',
  border: '#293650',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** 4pt spacing scale. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 30, fontWeight: '700' as const },
  title: { fontSize: 22, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
} as const;

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  /** Multiplier applied to spacing/type on larger screens. */
  scale: number;
}

export function buildTheme(mode: ThemeMode, isTablet: boolean): Theme {
  return {
    mode,
    colors: mode === 'dark' ? darkPalette : lightPalette,
    spacing,
    radius,
    typography,
    scale: isTablet ? 1.15 : 1,
  };
}

export const defaultTheme = buildTheme('light', false);
