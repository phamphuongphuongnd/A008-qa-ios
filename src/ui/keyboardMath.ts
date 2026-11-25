/** Pure maths behind keyboardGap.tsx / modalShown.ts (tested without React Native). */

/**
 * Window y of the keyboard's top edge (Android), or null when the event carries no usable size.
 * React Native reports `screenY` at the window's visible-frame bottom, which on some phones doesn't follow the
 * keyboard (A006 B-153); the screen height less the keyboard and the navigation bar is the other estimate — the
 * higher edge wins. Right after the app comes back to the foreground (opened from a notification) the first event can
 * carry height 0 (S-17 bug): then `fallbackHeight` (the last good keyboard height) is used.
 */
export function keyboardTop(e: { screenY: number; height: number }, screenHeight: number, navBar: number, fallbackHeight = 0): number | null {
  const height = e.height > 0 ? e.height : fallbackHeight;
  const fromHeight = height > 0 ? screenHeight - height - navBar : Number.POSITIVE_INFINITY;
  const fromY = e.screenY > 0 && e.screenY < screenHeight ? e.screenY : Number.POSITIVE_INFINITY;
  const top = Math.min(fromY, fromHeight);
  return Number.isFinite(top) ? top : null;
}

/** How far a view (window y + height) still reaches under the keyboard top: what it must pad. */
export function gapBelow(viewY: number, viewHeight: number, top: number | null): number {
  if (top === null || viewHeight <= 0) return 0;
  return Math.max(0, Math.round(viewY + viewHeight - top));
}

/** Re-measure times (ms after keyboardDidShow): the view may shrink late when the JS thread is busy (app resume). */
export const REMEASURE_MS = [150, 450, 900] as const;

/**
 * Delay before an autoFocus field inside a Sheet / Dialog takes focus (Android): 250 ms after the Modal is shown, and
 * not before the app has been in the foreground `settleMs` — a keyboard raised while the activity is still resuming
 * gets wrong insets (S-17 opened from a notification).
 */
export function modalFocusDelayMs(now: number, activeSince: number, baseMs = 250, settleMs = 800): number {
  return Math.max(baseMs, settleMs - (now - activeSince));
}
