/**
 * Design tokens. Screens must reference these rather than magic numbers so the
 * whole app can be rescaled (e.g. nudged up on tablets) from one place.
 *
 * Designed to support modern Bento Box & Soft Pastel UI aesthetics (flat, no drop shadows).
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

  // Modern Pastel Accent Colors (Inspired by reference mobile UI)
  pastelPurple: string;
  pastelPurpleText: string;
  pastelYellow: string;
  pastelYellowText: string;
  pastelGreen: string;
  pastelGreenText: string;
  pastelBlue: string;
  pastelBlueText: string;
  pastelPink: string;
  pastelPinkText: string;
  darkCapsule: string;
}

const lightPalette: Palette = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2F7',
  primary: '#1A1C23',
  primaryText: '#FFFFFF',
  text: '#181920',
  textMuted: '#6B7280',
  border: '#E8ECEF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  overlay: 'rgba(18, 19, 25, 0.45)',

  pastelPurple: '#E2D9FF',
  pastelPurpleText: '#36217A',
  pastelYellow: '#FEE585',
  pastelYellowText: '#714D00',
  pastelGreen: '#C5F6D0',
  pastelGreenText: '#0D542B',
  pastelBlue: '#B9E5FE',
  pastelBlueText: '#075985',
  pastelPink: '#FFC8DD',
  pastelPinkText: '#7A1C48',
  darkCapsule: '#16171D',
};

const darkPalette: Palette = {
  background: '#0F1015',
  surface: '#1B1C24',
  surfaceAlt: '#252733',
  primary: '#E2D9FF',
  primaryText: '#121217',
  text: '#F3F4F8',
  textMuted: '#9CA3AF',
  border: '#2E303E',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  overlay: 'rgba(0, 0, 0, 0.65)',

  pastelPurple: '#2E2648',
  pastelPurpleText: '#E9E3FF',
  pastelYellow: '#3D3316',
  pastelYellowText: '#FEF08A',
  pastelGreen: '#1C3B29',
  pastelGreenText: '#BBF7D0',
  pastelBlue: '#1B364A',
  pastelBlueText: '#BAE6FD',
  pastelPink: '#3D1D2C',
  pastelPinkText: '#FBCFE8',
  darkCapsule: '#181920',
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
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

// Completely flat shadows (No drop shadows)
export const shadows = {
  soft: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  card: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  floating: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
} as const;

export type ThemeMode = 'light' | 'dark';

export interface Theme {
  mode: ThemeMode;
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
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
    shadows,
    typography,
    scale: isTablet ? 1.15 : 1,
  };
}

export const defaultTheme = buildTheme('light', false);
