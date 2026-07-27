/**
 * Structured logging (guide §9.7).
 *
 * Development: loud console output so bugs are obvious.
 * Production: routed to a reporter. Wire Sentry in via `setReporter()` at app
 * start — nothing else in the codebase needs to know it exists.
 */

import { AppError, toAppError } from './AppError';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: AppError;
}

export type Reporter = (entry: LogEntry) => void;

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

let reporter: Reporter | null = null;

/** Ring buffer of recent entries, useful for an in-app diagnostics screen. */
const recent: LogEntry[] = [];
const MAX_RECENT = 100;

/** Swap in Sentry (or any sink) before release. */
export function setReporter(next: Reporter | null): void {
  reporter = next;
}

export function getRecentLogs(): readonly LogEntry[] {
  return recent;
}

function emit(entry: LogEntry): void {
  recent.push(entry);
  if (recent.length > MAX_RECENT) recent.shift();

  if (isDev) {
    const tag = `[${entry.level.toUpperCase()}]`;
    const detail = entry.error
      ? { code: entry.error.code, technical: entry.error.message, cause: entry.error.cause }
      : undefined;
    const args = [tag, entry.message, entry.context, detail].filter((a) => a !== undefined);
    if (entry.level === 'error') console.error(...args);
    else if (entry.level === 'warn') console.warn(...args);
    else console.log(...args);
  }

  try {
    reporter?.(entry);
  } catch {
    // A broken reporter must never take the app down.
  }
}

function make(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
  return { level, message, timestamp: new Date().toISOString(), context };
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (isDev) emit(make('debug', message, context));
  },

  info(message: string, context?: Record<string, unknown>): void {
    emit(make('info', message, context));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    emit(make('warn', message, context));
  },

  /** Logs the *technical* detail; the caller shows `error.userMessage`. */
  error(message: string, error?: unknown, context?: Record<string, unknown>): void {
    const appError = error === undefined ? undefined : toAppError(error);
    emit({
      ...make('error', message, { ...context, ...appError?.context }),
      error: appError,
    });
  },
};
