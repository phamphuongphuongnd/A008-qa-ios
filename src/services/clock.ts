/**
 * "Now" for screens that show time-based state (First-come clocks "41 h left", S-02 reminder cards). Ticks every
 * `everyMs` and — because JS timers sleep while the app is in the background — also the moment the app comes back to
 * the foreground, so a clock that ran out meanwhile shows "time is up" at once instead of after a restart (B-59).
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function useClock(everyMs = 60_000): Date {
  'use no memo';
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, everyMs);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') tick();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [everyMs]);
  return now;
}
