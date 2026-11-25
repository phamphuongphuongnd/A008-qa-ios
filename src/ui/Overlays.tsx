// Sheet / dialog / snackbar: Android fixes from A006 / A007 (B-32, B-149, B-153, B-181) kept as they were.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { fonts, layout, radius, useTheme } from '@/theme';

import { Button } from './Button';
import { useKeyboardGap } from './keyboardGap';
import { ModalShownContext, useShownState } from './modalShown';
import { Txt } from './Txt';
import { useKeyboardUp } from './useKeyboardUp';

/** A field focused underneath keeps its focus while a Modal is up; Android gives it the keyboard back on close. */
function useBlurUnderneath(visible: boolean) {
  useEffect(() => {
    if (visible && Platform.OS === 'android') Keyboard.dismiss();
  }, [visible]);
}

// ---------------- Confirm dialog ----------------

export interface ConfirmDialogProps {
  visible: boolean;
  /** Says what will happen ("Permanently delete data for 3 applicants?") — never "Are you sure?". */
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button (delete, discard, replace…). */
  destructive?: boolean;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  onConfirm: () => void;
  /** Cancel, Android back, and (Android) a tap outside. */
  onCancel: () => void;
  /** Extra content between the body and the buttons (S-27 "type DELETE" field). */
  children?: ReactNode;
}

/**
 * Dialog (S-24 mockup `.dlg`): safe action left (outline), confirm right — red when destructive. Android back / tap
 * outside = Cancel; iOS closes with Cancel only.
 */
export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = t('common:actions.cancel'),
  destructive,
  confirmDisabled,
  confirmLoading,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { colors } = useTheme();
  const { shown, onShow } = useShownState(visible);
  const keyboard = useKeyboardGap(visible);
  useBlurUnderneath(visible);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} onShow={onShow} statusBarTranslucent navigationBarTranslucent>
      <ModalShownContext.Provider value={shown}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.dlgWrap, { paddingBottom: keyboard.gap }]}>
          {keyboard.marker}
          <Pressable
            accessible={false}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            onPress={Platform.OS === 'android' ? onCancel : undefined}
          />
          <DialogCard title={title} body={body}>
            {children}
            <DialogActions
              cancelLabel={cancelLabel}
              confirmLabel={confirmLabel}
              destructive={destructive}
              confirmDisabled={confirmDisabled}
              confirmLoading={confirmLoading}
              onCancel={onCancel}
              onConfirm={onConfirm}
            />
          </DialogCard>
        </KeyboardAvoidingView>
      </ModalShownContext.Provider>
    </Modal>
  );
}

export function DialogActions({
  cancelLabel,
  confirmLabel,
  destructive,
  confirmDisabled,
  confirmLoading,
  onCancel,
  onConfirm,
}: Pick<ConfirmDialogProps, 'confirmLabel' | 'destructive' | 'confirmDisabled' | 'confirmLoading'> & { cancelLabel: string; onCancel?: () => void; onConfirm?: () => void }) {
  return (
    <View style={styles.acts}>
      <Button variant="secondary" label={cancelLabel} onPress={onCancel} style={styles.act} block />
      <Button
        variant={destructive ? 'danger' : 'primary'}
        label={confirmLabel}
        onPress={onConfirm}
        disabled={confirmDisabled}
        loading={confirmLoading}
        style={styles.act}
        block
      />
    </View>
  );
}

/** The dialog's card alone (also drawn still in the gallery). */
export function DialogCard({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View accessibilityViewIsModal accessibilityRole="alert" style={[styles.dlg, { backgroundColor: colors.surface }]}>
      <Txt v="subhead" accessibilityRole="header">
        {title}
      </Txt>
      {body ? (
        <Txt v="small" c="text2">
          {body}
        </Txt>
      ) : null}
      {children}
    </View>
  );
}

// ---------------- Bottom sheet ----------------

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Pinned under the content (Save). Stays above the keyboard and the navigation bar. */
  footer?: ReactNode;
  scroll?: boolean;
  /** Something was typed: closing asks "Discard changes?" first (product.md §5.0). */
  dirty?: boolean;
  /** A "Cancel" text button at the right of the title row; closes like the scrim (asks when dirty). */
  onCancel?: () => void;
}

/**
 * Bottom sheet (ev.css `.sheet`): radius 20 top, grab handle. Close by dragging down, tapping the dimmed area, Cancel
 * or Android back; with `dirty` it asks "Discard changes?" first. Grows above the keyboard and keeps its last button
 * above the navigation bar. Tablet: as wide as the content column.
 */
export function Sheet({ visible, onClose, title, children, footer, scroll = true, dirty, onCancel }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { shown, onShow } = useShownState(visible);
  const keyboard = useKeyboardGap(visible);
  const keyboardUp = useKeyboardUp();
  useBlurUnderneath(visible);
  const [asking, setAsking] = useState(false);
  const [drag] = useState(() => new Animated.Value(0));

  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onClose();
  }, [dirty, onClose]);
  const closeRef = useRef(requestClose);
  useEffect(() => {
    closeRef.current = requestClose;
  }, [requestClose]);

  // The handlers read the ref only when a drag happens, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 90 || g.vy > 1.2) closeRef.current();
        Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start(),
    }),
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={requestClose} onShow={onShow} statusBarTranslucent navigationBarTranslucent>
      <ModalShownContext.Provider value={shown}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingBottom: keyboard.gap }}>
          {keyboard.marker}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common:actions.close')}
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
            onPress={requestClose}
          />
          <View style={{ flex: 1 }} pointerEvents="box-none" />
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, paddingBottom: (keyboardUp ? 12 : Math.max(insets.bottom, 12)) + 12, transform: [{ translateY: drag }] },
            ]}>
            <SheetTop title={title} onCancel={onCancel ? () => (dirty ? setAsking(true) : onCancel()) : undefined} panHandlers={pan.panHandlers} />
            {scroll ? (
              <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14, paddingBottom: 4 }} keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
            ) : (
              children
            )}
            {footer}
          </Animated.View>
        </KeyboardAvoidingView>
        <ConfirmDialog
          visible={asking}
          title={t('common:discardChanges')}
          cancelLabel={t('common:actions.keepEditing')}
          confirmLabel={t('common:actions.discard')}
          destructive
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onClose();
          }}
        />
      </ModalShownContext.Provider>
    </Modal>
  );
}

function SheetTop({ title, onCancel, panHandlers }: { title?: string; onCancel?: () => void; panHandlers?: object }) {
  const { colors } = useTheme();
  return (
    <View {...panHandlers} style={styles.dragZone}>
      <View style={[styles.grab, { backgroundColor: colors.border }]} />
      {title || onCancel ? (
        <View style={styles.titleRow}>
          <Txt v="heading" accessibilityRole="header" style={{ flex: 1 }}>
            {title ?? ''}
          </Txt>
          {onCancel ? <Button variant="text" label={t('common:actions.cancel')} onPress={onCancel} style={{ marginRight: -10 }} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/** Still drawing of a sheet (gallery). */
export function SheetPreview({ title, children }: { title: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sheet, styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SheetTop title={title} />
      {children}
    </View>
  );
}

// ---------------- Snackbar ----------------

export interface SnackOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Went away without the action (commit a deferred delete here). */
  onDismiss?: () => void;
  /** ms; default 5000 with an action (product.md §5.0), 3000 without. Longer while a screen reader is on. */
  duration?: number;
  /** 'tabs': above the tab bar. 'none' (default): screens without one. */
  above?: 'tabs' | 'none';
  /** Extra lift (dp) above a sticky footer. */
  bottomOffset?: number;
}

const SnackCtx = createContext<(o: SnackOptions) => void>(() => {});
/** `const snack = useSnackbar(); snack({ message: 'Applicant deleted', actionLabel: 'Undo', onAction })`. */
export const useSnackbar = () => useContext(SnackCtx);

const TAB_BAR = 56;

/** One snackbar at a time; a new one replaces the current. Swipe sideways to dismiss. Mounted once in app/_layout. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<(SnackOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = useRef<(SnackOptions & { id: number }) | null>(null);
  const screenReader = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled()
      .then((on) => (screenReader.current = on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (on) => (screenReader.current = on));
    return () => sub.remove();
  }, []);

  const close = useCallback((acted: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    const s = current.current;
    current.current = null;
    setSnack(null);
    if (s && !acted) s.onDismiss?.();
  }, []);

  const show = useCallback(
    (o: SnackOptions) => {
      if (current.current) close(false);
      const s = { ...o, id: Date.now() };
      current.current = s;
      setSnack(s);
      const base = o.duration ?? (o.actionLabel ? 5000 : 3000);
      // A screen reader needs time to reach "Undo" by swiping.
      timer.current = setTimeout(() => close(false), o.actionLabel && screenReader.current ? Math.max(base, 12000) : base);
    },
    [close],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return (
    <SnackCtx.Provider value={show}>
      {children}
      {snack ? (
        <SnackbarHost
          key={snack.id}
          s={snack}
          onAction={() => {
            snack.onAction?.();
            close(true);
          }}
          onSwipe={() => close(false)}
        />
      ) : null}
    </SnackCtx.Provider>
  );
}

function SnackbarHost({ s, onAction, onSwipe }: { s: SnackOptions; onAction: () => void; onSwipe: () => void }) {
  const insets = useSafeAreaInsets();
  const [x] = useState(() => new Animated.Value(0));
  const swipeRef = useRef(onSwipe);
  useEffect(() => {
    swipeRef.current = onSwipe;
  }, [onSwipe]);
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => x.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > 90) swipeRef.current();
        else Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  );
  const bottom = insets.bottom + (s.above === 'tabs' ? TAB_BAR : 0) + 16 + (s.bottomOffset ?? 0);
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.snackWrap, { paddingBottom: bottom }]}>
      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }], width: '100%', maxWidth: layout.maxContentWidth - 32 }}>
        <SnackbarView message={s.message} actionLabel={s.actionLabel} onAction={onAction} />
      </Animated.View>
    </View>
  );
}

/** The bar itself (ev.css `.snack`; also drawn still in the gallery). */
export function SnackbarView({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  const { colors, dark } = useTheme();
  return (
    <View style={[styles.snack, { backgroundColor: colors.snackBg }]}>
      {/* No role on the row: an Android "alert" container swallows its children, so TalkBack couldn't reach Undo (A006). */}
      <Txt accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ flex: 1, color: colors.snackText, fontSize: 14, lineHeight: 20 }}>
        {message}
      </Txt>
      {actionLabel ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={6} style={styles.snackBtn}>
          {/* Light accent on the dark bar in both themes. */}
          <Txt style={{ color: dark ? colors.accent : '#7CC2C9', fontSize: 14, fontFamily: fonts.bold }}>{actionLabel}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dlgWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  dlg: { borderRadius: radius.dialog, padding: 22, gap: 12, width: '100%', maxWidth: 420, alignSelf: 'center' },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  act: { flexGrow: 1, flexBasis: 110 },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.gutter,
    gap: 14,
    maxHeight: '92%',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  preview: { borderWidth: 1, paddingBottom: 20, maxHeight: undefined },
  dragZone: { paddingTop: 10, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  grab: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center' },
  snackWrap: { justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16 },
  snack: { minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingRight: 6, paddingVertical: 4 },
  snackBtn: { minHeight: 44, minWidth: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
});
