/**
 * The last line of defence against a white screen (guide §9.4).
 *
 * Wraps the app and each major screen. A render-time throw is caught here and
 * turned into a calm recovery screen with a retry, instead of a blank app.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { logger } from '../../errors/logger';
import { toAppError } from '../../errors/AppError';
import { defaultTheme } from '../../config/theme';

interface Props {
  children: React.ReactNode;
  /** Named so logs say which screen broke. */
  label?: string;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error(`Render error in ${this.props.label ?? 'app'}`, toAppError(error), {
      componentStack: info.componentStack,
    });
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>😵</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          {this.props.label
            ? `The ${this.props.label} screen ran into a problem.`
            : 'QuickBill ran into a problem.'}{' '}
          Your saved sales and products are safe.
        </Text>

        {/* Loud in development, quiet in production (guide §9.8). */}
        {isDev ? <Text style={styles.technical}>{error.message}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={this.reset} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

// Plain StyleSheet, not the themed hook: a class component cannot use hooks,
// and this must render even if the theme/settings store is what failed.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: defaultTheme.colors.background,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: defaultTheme.colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: defaultTheme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  technical: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: defaultTheme.colors.danger,
    backgroundColor: defaultTheme.colors.surfaceAlt,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  button: {
    backgroundColor: defaultTheme.colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  buttonText: { color: defaultTheme.colors.primaryText, fontWeight: '700', fontSize: 15 },
});
