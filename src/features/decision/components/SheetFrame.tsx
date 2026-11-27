/**
 * Frame of the S-15 Decision sheet (B-48). The route is a native `formSheet` with `sheetAllowedDetents:
 * 'fitToContents'` (app/_layout.tsx): the sheet takes the height of what we render. With `Screen` (flex: 1) that was
 * the whole form, so choosing Deny made it taller than the screen — no scrolling, "Save decision" pushed off screen,
 * and the keyboard hid "Explain in your words".
 *
 * Here the sheet always has one fixed height (the space under the status bar), the body scrolls, the footer stays
 * outside the scroll area, and a spacer the height of the keyboard's overlap keeps the footer and the focused field
 * above the keyboard. The overlap is measured in window coordinates (the sheet can sit anywhere on screen), taking
 * the higher of the two keyboard tops Android reports (Samsung edge-to-edge reports `screenY` wrong — fact
 * expo-device-bugs-checklist). The keyboard's own height covers the navigation bar, so its inset is not added twice.
 */
import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Dimensions, Keyboard, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type ViewRef = ComponentRef<typeof View>;
export type SheetScrollRef = ComponentRef<typeof ScrollView>;

/** Height of the sheet: the window under the status bar, minus a small margin so the native sheet never clips it. */
export function decisionSheetHeight(windowHeight: number, insets: { top: number; bottom: number }, os: string = Platform.OS): number {
  // iOS formSheet stops a little under the top inset and pads the bottom inset itself.
  const margin = os === 'ios' ? insets.bottom + 24 : 12;
  return Math.max(240, Math.round(windowHeight - insets.top - margin));
}

/** Pixels of `frame` (window coordinates) hidden by a keyboard whose top edge is at `keyboardTop`. */
export function keyboardOverlap(frame: { y: number; height: number }, keyboard: { screenY: number; height: number }, screenHeight: number): number {
  const top = Math.min(keyboard.screenY, screenHeight - keyboard.height);
  return Math.max(0, Math.round(frame.y + frame.height - top));
}

function useKeyboardOverlap(ref: RefObject<ViewRef | null>): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const kb = e.endCoordinates;
      ref.current?.measureInWindow((_x: number, y: number, _w: number, height: number) => setOverlap(keyboardOverlap({ y, height }, kb, Dimensions.get('screen').height)));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);
  return overlap;
}

export function SheetFrame({
  header,
  footer,
  children,
  scrollRef,
  onKeyboard,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
  scrollRef?: RefObject<SheetScrollRef | null>;
  /** Called with the keyboard overlap after it changes (scroll the focused field into view). */
  onKeyboard?: (overlap: number) => void;
}) {
  const { colors, size } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const root = useRef<ViewRef>(null);
  const overlap = useKeyboardOverlap(root);
  const spacer = Math.max(0, overlap - insets.bottom);
  useEffect(() => {
    onKeyboard?.(overlap);
  }, [overlap, onKeyboard]);
  return (
    <View ref={root} style={{ height: decisionSheetHeight(height, insets), backgroundColor: colors.surface0 }}>
      {header}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, { maxWidth: size.contentMax }]}
      >
        {children}
      </ScrollView>
      {footer}
      <View style={{ height: spacer }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { width: '100%', alignSelf: 'center', paddingTop: 4, paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
});
