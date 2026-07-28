/**
 * Shared building blocks. Everything here reads spacing, colour and type from
 * the theme (guide §7) and honours the 44pt minimum touch target so a cashier
 * can hit controls fast without mis-taps.
 *
 * Implements modern Bento Box & Soft Pastel UI aesthetics (flat, no drop shadows, clean vector icons).
 */

import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, Edge, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../hooks/useResponsive';
import { MIN_TOUCH_TARGET } from '../../config/constants';
import { Theme } from '../../config/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Layout & Bento Components
// ---------------------------------------------------------------------------

/** Screen shell: safe-area aware, so nothing hides under a notch or Android status bar. */
export function Screen({
  children,
  style,
  scroll = false,
  edges = ['top', 'left', 'right'],
  contentStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const androidStatusBarHeight = Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) : 0;
  const topInsetPadding = edges?.includes('top')
    ? Math.max(insets.top, androidStatusBarHeight)
    : 0;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[{ padding: theme.spacing.lg, paddingBottom: 110 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.flex,
        {
          backgroundColor: theme.colors.background,
          paddingTop: topInsetPadding,
        },
        style,
      ]}
    >
      {body}
    </SafeAreaView>
  );
}

export type CardVariant =
  | 'surface'
  | 'purple'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'dark';

export function Card({
  children,
  style,
  padded = true,
  variant = 'surface',
  radiusSize = 'xl',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  variant?: CardVariant;
  radiusSize?: 'md' | 'lg' | 'xl' | 'pill';
}) {
  const theme = useTheme();

  const variantStyles: Record<CardVariant, { bg: string; text: string; border: string }> = {
    surface: { bg: theme.colors.surface, text: theme.colors.text, border: theme.colors.border },
    purple: { bg: theme.colors.pastelPurple, text: theme.colors.pastelPurpleText, border: 'transparent' },
    yellow: { bg: theme.colors.pastelYellow, text: theme.colors.pastelYellowText, border: 'transparent' },
    green: { bg: theme.colors.pastelGreen, text: theme.colors.pastelGreenText, border: 'transparent' },
    blue: { bg: theme.colors.pastelBlue, text: theme.colors.pastelBlueText, border: 'transparent' },
    pink: { bg: theme.colors.pastelPink, text: theme.colors.pastelPinkText, border: 'transparent' },
    dark: { bg: theme.colors.darkCapsule, text: '#FFFFFF', border: 'transparent' },
  };

  const current = variantStyles[variant];

  return (
    <View
      style={[
        {
          backgroundColor: current.bg,
          borderRadius: theme.radius[radiusSize],
          borderWidth: variant === 'surface' ? StyleSheet.hairlineWidth : 0,
          borderColor: current.border,
          padding: padded ? theme.spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Specialized Bento Box card with rounded pill tag and clean vector icon */
export function BentoCard({
  title,
  subtitle,
  tagLabel,
  tagTone = 'purple',
  variant = 'purple',
  icon,
  children,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string;
  tagLabel?: string;
  tagTone?: 'purple' | 'yellow' | 'green' | 'blue' | 'pink' | 'dark' | 'neutral';
  variant?: CardVariant;
  icon?: IconName;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  const iconColors: Record<CardVariant, string> = {
    surface: theme.colors.text,
    purple: theme.colors.pastelPurpleText,
    yellow: theme.colors.pastelYellowText,
    green: theme.colors.pastelGreenText,
    blue: theme.colors.pastelBlueText,
    pink: theme.colors.pastelPinkText,
    dark: theme.colors.text,
  };

  const cardContent = (
    <Card variant={variant} radiusSize="xl" style={style}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
          {tagLabel ? (
            <>
              <Badge label={tagLabel} tone={tagTone} />
              <Spacer size={theme.spacing.sm} />
            </>
          ) : null}
          <Txt variant="heading" style={{ fontSize: 20, fontWeight: '700' }}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" style={{ opacity: 0.8, marginTop: 4 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {icon ? (
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.4)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={22} color={iconColors[variant]} />
          </View>
        ) : null}
      </Row>
      {children ? <Spacer size={theme.spacing.md} /> : null}
      {children}
    </Card>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

/** Header Bar matching reference mobile screen design */
export function HeaderBar({
  title,
  subtitle,
  avatarText = 'SB',
  onActionPress,
  actionIcon = 'search-outline',
}: {
  title: string;
  subtitle?: string;
  avatarText?: string;
  onActionPress?: () => void;
  actionIcon?: IconName;
}) {
  const theme = useTheme();

  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: theme.spacing.lg }}>
      <Row gap={theme.spacing.md}>
        {/* User avatar rounded square */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: theme.colors.pastelPurple,
            borderWidth: 1.5,
            borderColor: theme.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.pastelPurpleText }}>
            {avatarText}
          </Text>
        </View>
        <View>
          <Txt variant="heading" style={{ fontSize: 18, fontWeight: '700' }}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="caption" color="muted">
              {subtitle}
            </Txt>
          ) : null}
        </View>
      </Row>

      {onActionPress ? (
        <Pressable
          onPress={onActionPress}
          style={({ pressed }) => [
            {
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: theme.colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name={actionIcon} size={20} color={theme.colors.text} />
        </Pressable>
      ) : null}
    </Row>
  );
}

export function Row({
  children,
  style,
  gap = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
  );
}

export function Spacer({ size = 12 }: { size?: number }) {
  return <View style={{ height: size, width: size }} />;
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }} />;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

type TypeVariant = keyof Theme['typography'];

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  align,
}: {
  children: React.ReactNode;
  variant?: TypeVariant;
  color?: 'text' | 'muted' | 'primary' | 'success' | 'warning' | 'danger';
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  align?: TextStyle['textAlign'];
}) {
  const theme = useTheme();
  const palette: Record<string, string> = {
    text: theme.colors.text,
    muted: theme.colors.textMuted,
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
  };
  const base = theme.typography[variant];

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: Math.round(base.fontSize * theme.scale),
          fontWeight: base.fontWeight,
          color: palette[color ?? 'text'],
          textAlign: align,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  size = 'medium',
  icon,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'yellow' | 'purple' | 'pill';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'medium' | 'large';
  icon?: IconName;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const background: Record<string, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.surfaceAlt,
    ghost: 'transparent',
    danger: theme.colors.danger,
    success: theme.colors.success,
    yellow: theme.colors.pastelYellow,
    purple: theme.colors.pastelPurple,
    pill: theme.colors.surface,
  };

  const foreground: Record<string, string> = {
    primary: theme.colors.primaryText,
    secondary: theme.colors.text,
    ghost: theme.colors.text,
    danger: '#FFFFFF',
    success: '#FFFFFF',
    yellow: theme.colors.pastelYellowText,
    purple: theme.colors.pastelPurpleText,
    pill: theme.colors.text,
  };

  const heights = { small: MIN_TOUCH_TARGET, medium: 50, large: 56 };

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        {
          backgroundColor: background[variant],
          minHeight: heights[size],
          borderRadius: variant === 'pill' ? theme.radius.pill : theme.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'ghost' || variant === 'pill' ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={foreground[variant]} /> : null}
      {icon ? <Ionicons name={icon} size={18} color={foreground[variant]} /> : null}
      <Text
        style={{
          color: foreground[variant],
          fontWeight: '700',
          fontSize: size === 'large' ? 16 : 14,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  style,
  icon,
  readOnly,
  verified,
  rightElement,
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
  icon?: IconName;
  /** Locks the field as non-editable with a muted background. */
  readOnly?: boolean;
  /** Shows a green verified checkmark badge below the field. */
  verified?: boolean;
  /** Optional element rendered on the right side of the field row. */
  rightElement?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View style={[{ gap: theme.spacing.xs }, style]}>
      {label ? (
        <Txt variant="label" color="muted">
          {label}
        </Txt>
      ) : null}
      <Row
        style={{
          minHeight: MIN_TOUCH_TARGET + 6,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: error
            ? theme.colors.danger
            : verified
              ? theme.colors.success
              : theme.colors.border,
          backgroundColor: readOnly ? theme.colors.surfaceAlt : theme.colors.surface,
          borderRadius: theme.radius.lg,
          paddingHorizontal: theme.spacing.md,
        }}
      >
        {icon ? <Ionicons name={icon} size={18} color={theme.colors.textMuted} style={{ marginRight: 8 }} /> : null}
        <TextInput
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={label}
          editable={!readOnly}
          {...inputProps}
          style={{
            flex: 1,
            fontSize: 15,
            color: readOnly ? theme.colors.textMuted : theme.colors.text,
            paddingVertical: 10,
            fontWeight: readOnly ? '600' : '400',
          }}
        />
        {rightElement}
      </Row>
      {verified ? (
        <Row gap={4} style={{ alignItems: 'center' }}>
          <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
          <Txt variant="caption" style={{ color: theme.colors.success, fontWeight: '600' }}>
            Scanned Successfully
          </Txt>
        </Row>
      ) : error ? (
        <Txt variant="caption" color="danger">
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" color="muted">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Badge({
  label,
  tone = 'purple',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' | 'purple' | 'yellow' | 'green' | 'blue' | 'pink' | 'dark';
}) {
  const theme = useTheme();

  const isDark = theme.mode === 'dark';
  const translucentBg = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.65)';

  const badgeStyles: Record<string, { bg: string; text: string }> = {
    neutral: { bg: theme.colors.surfaceAlt, text: theme.colors.textMuted },
    success: { bg: theme.colors.pastelGreen, text: theme.colors.pastelGreenText },
    warning: { bg: theme.colors.pastelYellow, text: theme.colors.pastelYellowText },
    danger: { bg: `${theme.colors.danger}20`, text: theme.colors.danger },
    primary: { bg: theme.colors.pastelPurple, text: theme.colors.pastelPurpleText },
    purple: { bg: translucentBg, text: theme.colors.pastelPurpleText },
    yellow: { bg: translucentBg, text: theme.colors.pastelYellowText },
    green: { bg: translucentBg, text: theme.colors.pastelGreenText },
    blue: { bg: translucentBg, text: theme.colors.pastelBlueText },
    pink: { bg: translucentBg, text: theme.colors.pastelPinkText },
    dark: { bg: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.2)', text: theme.colors.text },
  };

  const current = badgeStyles[tone] ?? badgeStyles.neutral;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        backgroundColor: current.bg,
      }}
    >
      <Text style={{ color: current.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 }}>
        {label}
      </Text>
    </View>
  );
}

/** Big +/− stepper — sized for fast, accurate taps at a counter. */
export function QtyStepper({
  quantity,
  onIncrease,
  onDecrease,
  disabled = false,
}: {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  const button = (icon: IconName, onPress: () => void, accessibilityLabel: string) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        backgroundColor: theme.colors.surfaceAlt,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={theme.colors.text} />
    </Pressable>
  );

  return (
    <Row gap={theme.spacing.xs}>
      {button('remove', onDecrease, 'Decrease quantity')}
      <Text
        accessibilityLabel={`Quantity ${quantity}`}
        style={{
          minWidth: 28,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: '700',
          color: theme.colors.text,
        }}
      >
        {quantity}
      </Text>
      {button('add', onIncrease, 'Increase quantity')}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={theme.colors.text} />
      <Spacer size={theme.spacing.md} />
      <Txt color="muted">{label}</Txt>
    </View>
  );
}

export function EmptyState({
  icon = 'cube-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.centered, { padding: theme.spacing.xl }]}>
      <Ionicons name={icon} size={48} color={theme.colors.textMuted} />
      <Spacer size={theme.spacing.md} />
      <Txt variant="heading" align="center">
        {title}
      </Txt>
      {message ? (
        <>
          <Spacer size={theme.spacing.sm} />
          <Txt color="muted" align="center">
            {message}
          </Txt>
        </>
      ) : null}
      {actionLabel && onAction ? (
        <>
          <Spacer size={theme.spacing.lg} />
          <Button title={actionLabel} onPress={onAction} />
        </>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Couldn't load this"
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

/** Inline, dismissible error banner for form and action failures. */
export function ErrorBanner({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onDismiss}
      accessibilityRole={onDismiss ? 'button' : undefined}
      accessibilityLabel={onDismiss ? 'Dismiss error' : undefined}
      style={{
        backgroundColor: `${theme.colors.danger}1A`,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.danger,
      }}
    >
      <Txt variant="label" color="danger">
        {message}
      </Txt>
      {onDismiss ? (
        <Txt variant="caption" color="muted">
          Tap to dismiss
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
