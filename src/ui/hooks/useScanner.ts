/**
 * Barcode scanning (guide §8.2), as a small state machine:
 *
 *   idle → scanning → found | notFound → (adding) → scanning
 *
 * The two details that make or break a real till:
 *  - the camera fires the same barcode many times a second, so a successful
 *    read locks scanning briefly — one physical scan is one item, not twenty;
 *  - the cashier gets a haptic pulse the instant a code is read, because they
 *    are watching the customer, not the screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useCameraPermissions } from 'expo-camera';
import { Product } from '../../domain/Product';
import { productService } from '../../services/ProductService';
import { SCAN_DEBOUNCE_MS } from '../../config/constants';
import { toAppError } from '../../errors/AppError';
import { logger } from '../../errors/logger';

export type ScanPhase = 'idle' | 'scanning' | 'looking-up' | 'found' | 'not-found' | 'error';

export interface ScanOutcome {
  barcode: string;
  product: Product | null;
}

interface UseScannerOptions {
  /** Called with the product when a scanned barcode matches one. */
  onFound?: (product: Product, barcode: string) => void;
  /**
   * Called when the barcode is unknown. The real-world flow is
   * scan → not found → add once → recognised forever (guide §8.2).
   */
  onNotFound?: (barcode: string) => void;
  /**
   * Fires on every accepted read, whatever the lookup found. Use this when the
   * caller just wants the digits — e.g. the scanner sheet that fills the
   * barcode field on the product form.
   */
  onScanned?: (barcode: string, product: Product | null) => void;
  /**
   * Set false to capture the barcode without hitting the database. Keeps
   * `onFound`/`onNotFound` silent so a capture-only caller never inherits the
   * "not found → navigate to Add Product" behaviour.
   */
  lookup?: boolean;
  autoStart?: boolean;
}

export function useScanner(options: UseScannerOptions = {}) {
  const { onFound, onNotFound, onScanned, lookup = true, autoStart = true } = options;

  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<ScanPhase>(autoStart ? 'scanning' : 'idle');
  const [lastScan, setLastScan] = useState<ScanOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);

  // Refs, not state: these gate the very next camera frame, so they must be
  // current immediately rather than after a re-render.
  const lockedRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const unlockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (unlockTimer.current) clearTimeout(unlockTimer.current);
    };
  }, []);

  const toggleTorch = useCallback(() => {
    setTorchOn((prev) => !prev);
  }, []);

  const unlockAfterDelay = useCallback(() => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    unlockTimer.current = setTimeout(() => {
      lockedRef.current = false;
      lastCodeRef.current = null;
      if (mounted.current) setPhase((current) => (current === 'idle' ? current : 'scanning'));
    }, SCAN_DEBOUNCE_MS);
  }, []);

  /** Frees the scanner right away — used after the cashier resolves a result. */
  const resume = useCallback(() => {
    if (unlockTimer.current) clearTimeout(unlockTimer.current);
    lockedRef.current = false;
    lastCodeRef.current = null;
    setLastScan(null);
    setError(null);
    setPhase('scanning');
  }, []);

  const pause = useCallback(() => {
    lockedRef.current = true;
    setPhase('idle');
  }, []);

  const handleBarcodeScanned = useCallback(
    async (raw: { data: string }) => {
      const barcode = raw?.data?.trim();
      if (!barcode) return;

      // Debounce: ignore everything while locked, and ignore an immediate
      // repeat of the code we just handled.
      if (lockedRef.current) return;
      if (lastCodeRef.current === barcode) return;

      lockedRef.current = true;
      lastCodeRef.current = barcode;
      setPhase('looking-up');
      setError(null);

      // Confirm the read before the (slower) database lookup, so the feedback
      // feels instant.
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      try {
        const product = lookup ? await productService.findByBarcode(barcode) : null;
        if (!mounted.current) return;

        setLastScan({ barcode, product });

        // Capture-only callers stop here: they wanted the digits, not a routing
        // decision about whether the product exists.
        if (!lookup) {
          setPhase('found');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onScanned?.(barcode, null);
          return;
        }

        onScanned?.(barcode, product);

        if (product) {
          setPhase('found');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onFound?.(product, barcode);
          unlockAfterDelay();
        } else {
          setPhase('not-found');
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          logger.info('Scanned an unknown barcode', { barcode });
          // Stays locked: the caller navigates to "add product" and calls
          // resume() when the cashier comes back.
          onNotFound?.(barcode);
        }
      } catch (err) {
        const appError = toAppError(err);
        logger.error('Barcode lookup failed', appError, { barcode });
        if (!mounted.current) return;
        setError(appError.userMessage);
        setPhase('error');
        unlockAfterDelay();
      }
    },
    [onFound, onNotFound, onScanned, lookup, unlockAfterDelay],
  );

  const permissionGranted = permission?.granted ?? false;
  const permissionDenied = permission !== null && !permission.granted && !permission.canAskAgain;

  return {
    permission,
    requestPermission,
    permissionGranted,
    /** Denied for good — the UI must offer a link to system settings, not crash. */
    permissionDenied,
    phase,
    lastScan,
    error,
    /** False while locked, so the camera prop can stop firing entirely. */
    isActive: phase === 'scanning',
    handleBarcodeScanned,
    resume,
    pause,
    /** Whether the camera torch/flashlight is enabled. */
    torchOn,
    /** Toggles the camera torch on/off. */
    toggleTorch,
  };
}
