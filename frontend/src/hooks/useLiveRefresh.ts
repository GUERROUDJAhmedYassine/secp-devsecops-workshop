import { useEffect, useRef } from 'react';

interface UseLiveRefreshOptions {
  enabled?: boolean;
  intervalMs?: number;
  runImmediately?: boolean;
}

export function useLiveRefresh(
  callback: () => void | Promise<void>,
  options: UseLiveRefreshOptions = {},
) {
  const {
    enabled = true,
    intervalMs = 8000,
    runImmediately = false,
  } = options;

  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;
    let running = false;

    const run = async () => {
      if (disposed || running) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      running = true;
      try {
        await callbackRef.current();
      } catch (error) {
        console.error(error);
      } finally {
        running = false;
      }
    };

    if (runImmediately) {
      void run();
    }

    const timer = window.setInterval(() => {
      void run();
    }, intervalMs);

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        void run();
      }
    };

    const handleFocus = () => {
      void run();
    };

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, intervalMs, runImmediately]);
}
