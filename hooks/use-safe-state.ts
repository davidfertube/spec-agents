"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Safe State Management Hooks
 * ============================
 *
 * These hooks prevent common React pitfalls:
 * 1. Setting state after component unmounts (causes memory leaks and warnings)
 * 2. Timeouts that persist after component unmounts (causes memory leaks)
 *
 * Always use these instead of regular useState/setTimeout in components
 * that might unmount while async operations are in flight.
 */

/**
 * A useState hook that prevents updates after unmount
 *
 * This prevents the "Can't perform a React state update on an unmounted component" warning,
 * which is a sign of a memory leak.
 *
 * @param initialValue - The initial state value
 * @returns A tuple of [state, setState] just like regular useState
 *
 * @example
 * ```typescript
 * const [data, setData] = useSafeState<string | null>(null);
 *
 * useEffect(() => {
 *   fetch('/api/data')
 *     .then(res => res.json())
 *     .then(data => setData(data)); // Safe even if component unmounts
 * }, []);
 * ```
 */
export function useSafeState<T>(
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialValue);
  const isMountedRef = useRef(true);

  // Track mounted status
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      // Mark as unmounted when component unmounts
      isMountedRef.current = false;
    };
  }, []);

  // Wrapped setState that only updates if component is still mounted
  const setSafeState = useCallback((value: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setState(value);
    } else {
      // Optional: Log this in development to help debug
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          'Attempted to set state on unmounted component. ' +
          'This was prevented by useSafeState.'
        );
      }
    }
  }, []);

  return [state, setSafeState];
}

/**
 * A timeout hook that auto-clears on unmount
 *
 * This prevents memory leaks from lingering timeouts when a component unmounts.
 *
 * Traditional setTimeout leaves the timeout running even after the component unmounts,
 * which can cause memory leaks and unexpected behavior.
 *
 * @returns Object with setSafeTimeout and clearSafeTimeout functions
 *
 * @example
 * ```typescript
 * const { setSafeTimeout, clearSafeTimeout } = useSafeTimeout();
 *
 * const handleClick = () => {
 *   setSafeTimeout(() => {
 *     console.log('This will not run if component unmounts');
 *   }, 1000);
 * };
 * ```
 */
export function useSafeTimeout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Clear timeout on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear any pending timeout when component unmounts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Set a timeout that will be automatically cleared on unmount
   *
   * @param callback - The function to call after the delay
   * @param delay - Delay in milliseconds
   */
  const setSafeTimeout = useCallback((callback: () => void, delay: number) => {
    // Clear any existing timeout first
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      // Only run callback if component is still mounted
      if (isMountedRef.current) {
        callback();
      }

      timeoutRef.current = null;
    }, delay);
  }, []);

  /**
   * Manually clear the timeout if needed
   */
  const clearSafeTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { setSafeTimeout, clearSafeTimeout };
}

/**
 * A interval hook that auto-clears on unmount
 *
 * Similar to useSafeTimeout but for setInterval
 *
 * @returns Object with setSafeInterval and clearSafeInterval functions
 *
 * @example
 * ```typescript
 * const { setSafeInterval, clearSafeInterval } = useSafeInterval();
 *
 * useEffect(() => {
 *   setSafeInterval(() => {
 *     // This will stop running when component unmounts
 *     console.log('Periodic check');
 *   }, 1000);
 * }, [setSafeInterval]);
 * ```
 */
export function useSafeInterval() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Clear interval on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear any pending interval when component unmounts
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  /**
   * Set an interval that will be automatically cleared on unmount
   *
   * @param callback - The function to call on each interval
   * @param delay - Delay in milliseconds between calls
   */
  const setSafeInterval = useCallback((callback: () => void, delay: number) => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set new interval
    intervalRef.current = setInterval(() => {
      // Only run callback if component is still mounted
      if (isMountedRef.current) {
        callback();
      }
    }, delay);
  }, []);

  /**
   * Manually clear the interval if needed
   */
  const clearSafeInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { setSafeInterval, clearSafeInterval };
}
