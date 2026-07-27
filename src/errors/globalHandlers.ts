/**
 * Global safety nets (guide §9.5). Installed once from App.tsx.
 * Nothing should ever reach the user as an uncaught crash.
 */

import { logger } from './logger';
import { toAppError } from './AppError';

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
}

let installed = false;

export function installGlobalErrorHandlers(): void {
  if (installed) return;
  installed = true;

  // 1. Uncaught JS exceptions, via React Native's ErrorUtils.
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils?.setGlobalHandler) {
    const previous = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error, isFatal) => {
      logger.error(isFatal ? 'Fatal uncaught error' : 'Uncaught error', error, { isFatal });
      // Keep the redbox in development; swallow in production so the
      // ErrorBoundary can render a recovery screen instead.
      previous?.(error, isFatal);
    });
  }

  // 2. Unhandled promise rejections.
  const scope = globalThis as unknown as {
    addEventListener?: (type: string, listener: (event: unknown) => void) => void;
  };
  if (typeof scope.addEventListener === 'function') {
    scope.addEventListener('unhandledrejection', (event: unknown) => {
      const reason = (event as { reason?: unknown })?.reason ?? event;
      logger.error('Unhandled promise rejection', reason);
    });
  }
}

/**
 * Fire-and-forget async work that still reports failures.
 * Use instead of a bare `void somePromise()`.
 */
export function reportIfRejected(promise: Promise<unknown>, label: string): void {
  promise.catch((error) => {
    logger.error(`${label} failed`, toAppError(error));
  });
}
