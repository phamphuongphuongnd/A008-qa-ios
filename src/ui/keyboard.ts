/**
 * Keyboard room for the bottom `Sheet` (B-72d). `KeyboardAvoidingView` (behavior "height") inside the sheet's Modal
 * squeezed the sheet on a landscape tablet until its scroll area had no height left: the banner and "Type it again"
 * of S-22 "Set a backup password" were drawn 0 high. Here:
 * - the overlap is measured in window coordinates and re-measured when the sheet's root changes size, so a window the
 *   system already shrank above the keyboard is not shrunk a second time; the keyboard top is the higher of the two
 *   values Android reports (Samsung edge-to-edge reports `screenY` wrong — same rule as S-15's SheetFrame, B-48);
 * - with the keyboard up the navigation-bar inset is not padded (the keyboard covers it);
 * - when what is left is too short for title + fields + footer, the footer scrolls with the fields (`compact`) so the
 *   fields always keep their height.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Dimensions, Keyboard, Platform, View, type KeyboardMetrics } from 'react-native';

type ViewRef = ComponentRef<typeof View>;

/** Pixels of `frame` (window coordinates) hidden by the keyboard. */
export function keyboardOverlap(frame: { y: number; height: number }, keyboard: { screenY: number; height: number }, screenHeight: number): number {
  const top = Math.min(keyboard.screenY, screenHeight - keyboard.height);
  return Math.max(0, Math.round(frame.y + frame.height - top));
}

/** Below this much room (dp, under the status bar and above the keyboard) the sheet's footer scrolls with its body. */
export const SHEET_COMPACT_ROOM = 440;

export interface SheetRoom {
  /** Space between the sheet's bottom edge and the window's bottom (the keyboard). */
  keyboardSpace: number;
  maxHeight: number;
  paddingBottom: number;
  compact: boolean;
}

/** Height budget of a bottom sheet in a full-screen Modal of `windowHeight`, `overlap` px of it under the keyboard. */
export function sheetRoom(windowHeight: number, overlap: number, insets: { top: number; bottom: number }): SheetRoom {
  if (overlap <= 0) {
    return { keyboardSpace: 0, maxHeight: Math.round(windowHeight * 0.92), paddingBottom: Math.max(insets.bottom, 8) + 20, compact: false };
  }
  const room = Math.max(0, windowHeight - overlap - insets.top - 8);
  return { keyboardSpace: overlap, maxHeight: room, paddingBottom: 12, compact: room < SHEET_COMPACT_ROOM };
}

/** Keyboard overlap of the view behind `ref` (call `onLayout` from that view's onLayout). */
export function useKeyboardOverlap(ref: RefObject<ViewRef | null>): { overlap: number; onLayout: () => void } {
  const [overlap, setOverlap] = useState(0);
  const keyboard = useRef<KeyboardMetrics | null>(null);
  const measure = useCallback(() => {
    const kb = keyboard.current;
    if (!kb) return setOverlap(0);
    ref.current?.measureInWindow((_x: number, y: number, _w: number, height: number) =>
      setOverlap(keyboardOverlap({ y, height }, kb, Dimensions.get('screen').height)),
    );
  }, [ref]);
  useEffect(() => {
    // Already up when the sheet opens (a field of the screen behind had focus).
    if (Keyboard.isVisible?.()) {
      keyboard.current = Keyboard.metrics?.() ?? null;
      measure();
    }
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboard.current = e.endCoordinates;
      measure();
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboard.current = null;
      setOverlap(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [measure]);
  return { overlap, onLayout: measure };
}
