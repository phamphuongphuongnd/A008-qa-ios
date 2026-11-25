// From A006 (src/ui/modalShown.ts, B-149).
import { createContext, useContext, useState } from 'react';
import { AppState } from 'react-native';

import { modalFocusDelayMs } from './keyboardMath';

/**
 * B-149: on Android a TextInput's `autoFocus` inside a Modal (Dialog / Sheet) focuses the field but never raises the
 * keyboard, and focus() right at the Modal's onShow sometimes misses it too. Dialog / Sheet say here when their Modal
 * window is up (null = not inside one); `Field` with `autoFocus` then focuses MODAL_FOCUS_DELAY_MS later.
 */
export const ModalShownContext = createContext<boolean | null>(null);
export const useModalShown = () => useContext(ModalShownContext);
export const MODAL_FOCUS_DELAY_MS = 250;

// When the app last came to the foreground (module load = cold start, e.g. opened from a notification).
let activeSince = Date.now();
AppState.addEventListener('change', (s) => {
  if (s === 'active') activeSince = Date.now();
});

/** ms to wait from the Modal's onShow before focusing (longer right after the app was opened / resumed — S-17). */
export function modalFocusDelay(now = Date.now()): number {
  return modalFocusDelayMs(now, activeSince, MODAL_FOCUS_DELAY_MS);
}

/** For Dialog / Sheet: `shown` turns true at the Modal's onShow and back to false when it is hidden. */
export function useShownState(visible: boolean) {
  const [shown, setShown] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  // Hidden → reset during render (not in an effect), so a reopened dialog waits for its next onShow.
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setShown(false);
  }
  return { shown: visible && shown, onShow: () => setShown(true) };
}
