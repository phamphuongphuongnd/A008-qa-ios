// From A006 (src/ui/keyboardGap.tsx, B-153), hardened for A007 S-17 (sheet opened from a notification).
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { AppState, Dimensions, Keyboard, Platform, StyleSheet, View, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gapBelow, keyboardTop, REMEASURE_MS } from './keyboardMath';

/** Last keyboard height a show event reported (> 0): the fallback when an event right after a resume says 0. */
let lastGoodHeight = 0;

/**
 * B-153 (Android): how far a `KeyboardAvoidingView` ('height') still reaches under the keyboard, for it to pad.
 *
 * React Native puts the keyboard's top at the window's visible-frame bottom. On some phones (Galaxy A13, Android 14,
 * edge-to-edge) that frame doesn't follow the keyboard, so the view shrank ~460 of ~990 px and the last fields and
 * buttons stayed under it. The keyboard's top is also the screen height less the keyboard and the navigation bar
 * under it: take the higher of the two (`keyboardTop`), and return what of the view is still below.
 *
 * S-17 (2C): right after the app opened from a notification the first measurement came too early / with an empty
 * keyboard size and Save stayed under the keyboard until it was closed and reopened. Now: measured again at
 * REMEASURE_MS after each show (the view may shrink late while the JS thread is busy), a zero-height event falls back
 * to the last good height, and a return to the foreground with the keyboard up measures again.
 *
 * Render `marker` inside the keyboard-avoiding view (it measures the view's box) and add the gap to its
 * `paddingBottom`. 0 on iOS.
 */
export function useKeyboardGap(enabled = true): { gap: number; marker: ReactNode } {
  const [gap, setGap] = useState(0);
  const ref = useRef<ComponentRef<typeof View>>(null);
  const navBar = useSafeAreaInsets().bottom;
  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    let current: KeyboardEvent['endCoordinates'] | null = null;
    const clear = () => {
      timers.forEach(clearTimeout);
      timers = [];
    };
    const measure = () => {
      if (!current) return;
      const top = keyboardTop(current, Dimensions.get('screen').height, navBar, lastGoodHeight);
      ref.current?.measureInWindow((_x, y, _w, h) => {
        if (h > 0) setGap(gapBelow(y, h, top));
      });
    };
    const schedule = () => {
      clear();
      timers = REMEASURE_MS.map((ms) => setTimeout(measure, ms));
    };
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      current = e.endCoordinates;
      if (e.endCoordinates.height > 0) lastGoodHeight = e.endCoordinates.height;
      schedule();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      clear();
      current = null;
      setGap(0);
    });
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Keyboard.isVisible()) {
        const m = Keyboard.metrics();
        if (m) current = m;
        schedule();
      }
    });
    // The keyboard may already be up when this sheet / screen mounts.
    if (Keyboard.isVisible()) {
      const m = Keyboard.metrics();
      if (m) {
        current = m;
        schedule();
      }
    }
    return () => {
      clear();
      show.remove();
      hide.remove();
      app.remove();
    };
  }, [enabled, navBar]);
  const marker =
    Platform.OS === 'android' && enabled ? (
      // Fills the view's box whatever its padding: its bottom is the view's bottom.
      <View ref={ref} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />
    ) : null;
  return { gap, marker };
}
