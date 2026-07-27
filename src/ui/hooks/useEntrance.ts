/**
 * Entrance and ambient animations.
 *
 * Note on GSAP: it animates DOM nodes and has no effect in React Native, which
 * renders real native views. The equivalent here is RN's `Animated` API driving
 * transform/opacity with `useNativeDriver: true`, which runs the animation on
 * the UI thread — so it stays smooth even while the JS thread is busy opening
 * the database or running a barcode lookup.
 *
 * Only `opacity` and `transform` are animated; those are the properties the
 * native driver supports. Animating width/height/colour would silently fall
 * back to the JS thread and stutter.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

export interface EntranceOptions {
  /** Delay before this element starts, for staggering a list. */
  delay?: number;
  duration?: number;
  /** Distance in dp the element travels upward as it fades in. */
  distance?: number;
}

/**
 * Fade + slide up on mount. Returns a style object to spread onto an
 * `Animated.View`.
 */
export function useEntrance({ delay = 0, duration = 450, distance = 16 }: EntranceOptions = {}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      // Decelerate: fast start, gentle settle. Reads as "arriving" rather than
      // "sliding", which is what makes it feel responsive rather than slow.
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay, duration]);

  return useMemo(
    () => ({
      opacity: progress,
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [distance, 0],
          }),
        },
      ],
    }),
    [progress, distance],
  );
}

/** Spring-in scale, for a logo or hero mark. */
export function usePopIn({ delay = 0 }: { delay?: number } = {}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(progress, {
      toValue: 1,
      delay,
      friction: 6,
      tension: 70,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);

  return useMemo(
    () => ({
      opacity: progress,
      transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
    }),
    [progress],
  );
}

/**
 * Slow, endless drift — used for the decorative background shapes so the
 * screen feels alive without demanding attention.
 */
export function useFloat({
  duration = 3200,
  distance = 12,
  delay = 0,
}: { duration?: number; distance?: number; delay?: number } = {}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    // Loops keep running after unmount unless stopped, which leaks the
    // animation frame callback.
    return () => loop.stop();
  }, [progress, duration, delay]);

  return useMemo(
    () => ({
      transform: [
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -distance],
          }),
        },
      ],
    }),
    [progress, distance],
  );
}
