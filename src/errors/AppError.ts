/**
 * Typed error hierarchy (guide §9.1).
 *
 * Every error carries two messages:
 *   - `userMessage`  → calm, actionable, shown in the UI
 *   - `message`      → technical detail, sent to the logger only
 *
 * Screens branch on the *type*, never on string matching.
 */

export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'DATABASE'
  | 'NETWORK'
  | 'PRINTER'
  | 'PERMISSION'
  | 'AUTH'
  | 'UNKNOWN';

export abstract class AppError extends Error {
  abstract readonly code: ErrorCode;

  /** Safe to show to a cashier mid-sale. */
  readonly userMessage: string;

  /** The original error, if this wraps one. */
  readonly cause?: unknown;

  /** Extra structured detail for the log. */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    userMessage: string,
    options?: { cause?: unknown; context?: Record<string, unknown> },
  ) {
    super(message);
    this.name = new.target.name;
    this.userMessage = userMessage;
    this.cause = options?.cause;
    this.context = options?.context;
    // Required so `instanceof` works after TS downlevels the class.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Bad user input — a negative price, a blank barcode. */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION' as const;
  /** Field name → message, for wiring straight into a form. */
  readonly fields?: Record<string, string>;

  constructor(
    message: string,
    options?: {
      userMessage?: string;
      fields?: Record<string, string>;
      cause?: unknown;
      context?: Record<string, unknown>;
    },
  ) {
    super(message, options?.userMessage ?? message, options);
    this.fields = options?.fields;
  }
}

/** A barcode, product or invoice that does not exist. */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND' as const;
  readonly entity: string;
  readonly identifier: string;

  constructor(entity: string, identifier: string, options?: { cause?: unknown }) {
    super(
      `${entity} not found: ${identifier}`,
      `That ${entity.toLowerCase()} could not be found.`,
      options,
    );
    this.entity = entity;
    this.identifier = identifier;
  }
}

/** SQLite failed. */
export class DatabaseError extends AppError {
  readonly code = 'DATABASE' as const;

  constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message, 'Could not save your data. Please try again.', options);
  }
}

/** Cloud sync / any network call failed. Never fatal — the app is offline-first. */
export class NetworkError extends AppError {
  readonly code = 'NETWORK' as const;

  constructor(message: string, options?: { cause?: unknown; context?: Record<string, unknown> }) {
    super(message, 'No connection. Your work is saved on this device.', options);
  }
}

/** Bluetooth or PDF output failed. */
export class PrinterError extends AppError {
  readonly code = 'PRINTER' as const;
  /** True when falling back to another strategy is worth offering. */
  readonly recoverable: boolean;

  constructor(
    message: string,
    options?: { userMessage?: string; recoverable?: boolean; cause?: unknown },
  ) {
    super(
      message,
      options?.userMessage ?? 'Could not print the bill. The sale is still saved.',
      options,
    );
    this.recoverable = options?.recoverable ?? true;
  }
}

/** Camera / storage permission denied. */
export class PermissionError extends AppError {
  readonly code = 'PERMISSION' as const;

  constructor(permission: string, options?: { cause?: unknown }) {
    super(
      `Permission denied: ${permission}`,
      `QuickBill needs ${permission} access to continue. You can enable it in Settings.`,
      options,
    );
  }
}

/** Wrong credentials, or a cashier reaching for an admin-only screen. */
export class AuthError extends AppError {
  readonly code = 'AUTH' as const;

  constructor(message: string, options?: { userMessage?: string; cause?: unknown }) {
    super(message, options?.userMessage ?? 'Incorrect username or password.', options);
  }
}

/** Anything that escaped the typed layers. */
export class UnknownError extends AppError {
  readonly code = 'UNKNOWN' as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, 'Something went wrong. Please try again.', options);
  }
}

/**
 * Normalises anything thrown into an AppError, so UI code can rely on
 * `.userMessage` always being present.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new UnknownError(error.message, { cause: error });
  }
  return new UnknownError(String(error), { cause: error });
}

/** Convenience for screens: the message that is safe to render. */
export function userMessageOf(error: unknown): string {
  return toAppError(error).userMessage;
}
