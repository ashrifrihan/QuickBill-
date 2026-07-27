/**
 * Shared building blocks. Everything here reads spacing, colour and type from
 * the theme (guide §7) and honours the 44pt minimum touch target so a cashier
 * can hit controls fast without mis-taps.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useResponsive';
import { MIN_TOUCH_TARGET } from '../../config/constants';
import { Theme } from '../../config/theme';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Screen shell: safe-area aware, so nothing hides under a notch. */
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
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[{ padding: theme.spacing.lg }, contentStyle]}
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
      style={[styles.flex, { backgroundColor: theme.colors.background }, style]}
    >
      {body}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border,
          padding: padded ? theme.spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
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
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'small' | 'medium' | 'large';
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
  };
  const foreground: Record<string, string> = {
    primary: theme.colors.primaryText,
    secondary: theme.colors.text,
    ghost: theme.colors.primary,
    danger: '#FFFFFF',
    success: '#FFFFFF',
  };

  const heights = { small: MIN_TOUCH_TARGET, medium: 50, large: 58 };

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
          borderRadius: theme.radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={foreground[variant]} /> : null}
      <Text
        style={{
          color: foreground[variant],
          fontWeight: '700',
          fontSize: size === 'large' ? 17 : 15,
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
  ...inputProps
}: TextInputProps & {
  label?: string;
  error?: string;
  hint?: string;
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
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        accessibilityLabel={label}
        {...inputProps}
        style={{
          minHeight: MIN_TOUCH_TARGET + 4,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: error ? theme.colors.danger : theme.colors.border,
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing.md,
          fontSize: 16, // 16+ stops iOS zooming the page on focus
          color: theme.colors.text,
        }}
      />
      {error ? (
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
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
}) {
  const theme = useTheme();
  const colors: Record<string, string> = {
    neutral: theme.colors.textMuted,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    primary: theme.colors.primary,
  };
  const color = colors[tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
        borderRadius: theme.radius.pill,
        backgroundColor: `${color}1A`, // ~10% alpha
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
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

  const button = (label: string, onPress: () => void, accessibilityLabel: string) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceAlt,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 22, fontWeight: '600', color: theme.colors.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <Row gap={theme.spacing.sm}>
      {button('−', onDecrease, 'Decrease quantity')}
      <Text
        accessibilityLabel={`Quantity ${quantity}`}
        style={{
          minWidth: 34,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: '700',
          color: theme.colors.text,
        }}
      >
        {quantity}
      </Text>
      {button('+', onIncrease, 'Increase quantity')}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// The three states every data screen must have (guide §9.6)
// ---------------------------------------------------------------------------

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Spacer size={theme.spacing.md} />
      <Txt color="muted">{label}</Txt>
    </View>
  );
}

export function EmptyState({
  icon = '📦',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.centered, { padding: theme.spacing.xl }]}>
      <Text style={{ fontSize: 44 }}>{icon}</Text>
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
      icon="⚠️"
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
        borderRadius: theme.radius.md,
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
