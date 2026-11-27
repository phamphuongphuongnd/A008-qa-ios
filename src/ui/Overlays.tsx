import { usePreventRemove, useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { font, useTheme } from '@/theme';

import { Button, IconButton, type IconComponent } from './Button';
import { Glyph, type GlyphName } from './Glyph';
import { sheetRoom, useKeyboardOverlap } from './keyboard';
import { Txt } from './Txt';

// ---------------------------------------------------------------- Confirm dialog

export type DialogTone = 'danger' | 'warn' | 'accent';

export interface DialogCardProps {
  title: string;
  body?: string;
  tone?: DialogTone;
  /** Icon in the 48 circle; default trash (danger) / alert (warn, accent). */
  glyph?: GlyphName;
  /** Safe action, LEFT (product.md §5.0). Default "Cancel". */
  cancelLabel?: string;
  /** Action, RIGHT: red when `destructive`, else primary. */
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Confirm running (spinner, both buttons off). */
  busy?: boolean;
  /** Extra content between text and buttons (a "type DELETE" field). */
  children?: ReactNode;
  confirmDisabled?: boolean;
}

/** The dialog card itself (also drawn statically in the gallery). */
export function DialogCard({
  title,
  body,
  tone = 'danger',
  glyph,
  cancelLabel,
  confirmLabel,
  destructive = tone === 'danger',
  onCancel,
  onConfirm,
  busy,
  children,
  confirmDisabled,
}: DialogCardProps) {
  const { colors, radius, shadows } = useTheme();
  const ic = {
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    accent: { bg: colors.accentSoft, fg: colors.accent },
  }[tone];
  return (
    <View
      accessibilityViewIsModal
      style={[styles.dialog, { backgroundColor: colors.surface1, borderRadius: radius.xl, boxShadow: shadows.sheet }]}
    >
      <View style={[styles.dialogIc, { backgroundColor: ic.bg }]} importantForAccessibility="no-hide-descendants">
        <Glyph name={glyph ?? (tone === 'danger' ? 'trash' : 'alertCircle')} size={24} color={ic.fg} />
      </View>
      <Txt accessibilityRole="header" style={font(650, 19, 25)}>
        {title}
      </Txt>
      {body ? <Txt style={[font(400, 15, 22), { color: colors.inkMuted }]}>{body}</Txt> : null}
      {children}
      <View style={styles.btnrow}>
        <Button
          variant="secondary"
          label={cancelLabel ?? t('common:actions.cancel')}
          onPress={onCancel}
          disabled={busy}
          style={styles.btnFlex}
          block
        />
        <Button
          variant={destructive ? 'danger' : 'primary'}
          label={confirmLabel}
          onPress={onConfirm}
          loading={busy}
          disabled={confirmDisabled}
          style={styles.btnFlex}
          block
        />
      </View>
    </View>
  );
}

/**
 * Confirm dialog: safe button left, destructive (red) right; scrim tap / back = cancel.
 * `<ConfirmDialog visible={open} title="Permanently delete data for 3 applicants?" body="This can't be undone."
 *   confirmLabel="Delete" onCancel={…} onConfirm={…} />`
 */
export function ConfirmDialog({ visible, ...card }: DialogCardProps & { visible: boolean }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={card.busy ? undefined : card.onCancel}>
      <DialogLayer scrim={colors.scrim} onCancel={card.busy ? undefined : card.onCancel}>
        <DialogCard {...card} />
      </DialogLayer>
    </Modal>
  );
}

function DialogLayer({ scrim, onCancel, children }: { scrim: string; onCancel?: () => void; children: ReactNode }) {
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.center}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]}
        onPress={onCancel}
        accessible={false}
        importantForAccessibility="no"
      />
      {children}
    </KeyboardAvoidingView>
  );
}

/** "Discard changes?" with Keep editing (left) / Discard (red, right). */
export function DiscardDialog({ visible, onKeep, onDiscard }: { visible: boolean; onKeep: () => void; onDiscard: () => void }) {
  return (
    <ConfirmDialog
      visible={visible}
      tone="warn"
      title={t('common:discardChanges')}
      cancelLabel={t('common:actions.keepEditing')}
      confirmLabel={t('common:actions.discard')}
      destructive
      onCancel={onKeep}
      onConfirm={onDiscard}
    />
  );
}

/**
 * For a screen presented as a native sheet (S-07, S-15 formSheet) or any form screen: while `dirty`, leaving
 * (swipe down, back, router.back) asks "Discard changes?". Render the returned element.
 *
 * B-47: "Discard" must turn the prevention OFF before the blocked action runs again. Re-dispatching `data.action`
 * while `usePreventRemove(dirty)` is still on gets blocked again → the dialog comes back forever. `repeat()` (from
 * usePreventRemove) disables the prevention and re-dispatches in the same batch; `leaving` keeps the prop false so the
 * hook does not switch it back on before the screen is gone.
 */
export function useDiscardGuard(dirty: boolean): ReactNode {
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [leaving, setLeaving] = useState(false);
  usePreventRemove(dirty && !leaving, ({ repeat }) => setPending(() => repeat));
  return (
    <DiscardDialog
      visible={!!pending}
      onKeep={() => setPending(null)}
      onDiscard={() => {
        const repeat = pending;
        setPending(null);
        setLeaving(true);
        repeat?.();
      }}
    />
  );
}

// ---------------------------------------------------------------- Bottom sheet

/** Sheet surface (grab handle, title row with close, content) — drawn statically in the gallery too. */
export function SheetSurface({
  title,
  onClose,
  children,
  footer,
  grab,
  style,
}: {
  title?: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  grab?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius, shadows } = useTheme();
  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: colors.surface1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, boxShadow: shadows.sheet },
        style,
      ]}
    >
      {grab ?? <View style={[styles.grab, { backgroundColor: colors.lineStrong }]} />}
      {title || onClose ? (
        <View style={styles.sh}>
          <Txt accessibilityRole="header" style={[font(650, 19, 24), { flex: 1 }]}>
            {title}
          </Txt>
          {onClose ? <IconButton icon={X} accessibilityLabel={t('common:actions.close')} onPress={onClose} /> : null}
        </View>
      ) : null}
      {children}
      {footer}
    </View>
  );
}

/**
 * Bottom sheet over the current screen: drag the handle down, tap the scrim, Cancel / back closes it. With `dirty`
 * any of those first asks "Discard changes?". Content scrolls; the keyboard pushes it up (Android too) — measured, not
 * KeyboardAvoidingView, and when little room is left the footer scrolls with the fields (B-72d, ./keyboard.ts).
 * Max width 600 on tablets.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
  dirty,
}: {
  visible: boolean;
  /** Close for real (after the discard check). */
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Sticky buttons under the scrolling content. */
  footer?: ReactNode;
  dirty?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [drag] = useState(() => new Animated.Value(height));
  const [asking, setAsking] = useState(false);
  const root = useRef<ComponentRef<typeof View>>(null);
  const keyboard = useKeyboardOverlap(root);
  const room = sheetRoom(height, keyboard.overlap, insets);

  useEffect(() => {
    if (visible) {
      drag.setValue(height);
      Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
    }
  }, [visible, drag, height]);

  const requestClose = () => {
    if (dirty) {
      Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      setAsking(true);
    } else {
      Animated.timing(drag, { toValue: height, duration: 180, useNativeDriver: true }).start(() => onClose());
    }
  };

  const pan = usePanGesture({
    runOnJS: true,
    onUpdate: (e) => drag.setValue(Math.max(0, e.translationY)),
    onDeactivate: (e) => {
      if (e.translationY > 120 || e.velocityY > 900) requestClose();
      else Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    },
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={requestClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View ref={root} onLayout={keyboard.onLayout} style={[styles.bottom, { paddingBottom: room.keyboardSpace }]}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.scrim, opacity: drag.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: 'clamp' }) },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessible={false} importantForAccessibility="no" />
          </Animated.View>
          <Animated.View style={[styles.sheetWrap, { maxHeight: room.maxHeight, transform: [{ translateY: drag }] }]}>
            <SheetSurface
              title={title}
              onClose={requestClose}
              style={{ paddingBottom: room.paddingBottom }}
              grab={
                <GestureDetector gesture={pan}>
                  <View
                    style={styles.grabArea}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('common:actions.close')}
                    accessibilityHint={t('ui:sheet.dragHint')}
                    onAccessibilityTap={requestClose}
                  >
                    <View style={[styles.grab, { backgroundColor: colors.lineStrong }]} />
                  </View>
                </GestureDetector>
              }
              footer={room.compact ? undefined : footer}
            >
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }} style={{ flexGrow: 0 }}>
                {children}
                {room.compact ? footer : null}
              </ScrollView>
            </SheetSurface>
          </Animated.View>
          {asking ? (
            <View style={StyleSheet.absoluteFill}>
              <DialogLayer scrim="transparent" onCancel={() => setAsking(false)}>
                <DialogCard
                  tone="warn"
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
              </DialogLayer>
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Big option row inside a sheet (S-07 Add applicant: Enter / Hand the phone / Paper form). */
export function BigOption({
  icon: Icon,
  title,
  description,
  onPress,
}: {
  icon: IconComponent;
  title: string;
  description?: string;
  onPress: () => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      style={({ pressed }) => [
        styles.bigopt,
        { backgroundColor: pressed ? colors.surface2 : colors.surface0, borderColor: colors.line, borderRadius: radius.lg },
      ]}
    >
      <View style={[styles.bigIc, { backgroundColor: colors.accentSoft }]}>
        <Icon color={colors.accent} size={24} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={font(600, 16, 22)}>{title}</Txt>
        {description ? <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{description}</Txt> : null}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------- Snackbar

export interface SnackbarOptions {
  message: string;
  /** "Undo". */
  actionLabel?: string;
  onAction?: () => void;
  /** ms; default 5000 (longer when a screen reader is on — product.md §5.0). */
  duration?: number;
}

type SnackState = (SnackbarOptions & { id: number }) | null;
let snack: SnackState = null;
let snackId = 0;
let offset: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Show a snackbar (replaces the one showing): `showSnackbar({ message: 'Applicant deleted', actionLabel: 'Undo', onAction })`. */
export function showSnackbar(options: SnackbarOptions): void {
  snack = { ...options, id: ++snackId };
  emit();
}

export function hideSnackbar(): void {
  snack = null;
  emit();
}

/**
 * While this screen is focused, keep the snackbar `px` above the bottom safe area (clear a button bar / tab bar /
 * FAB so a late Undo tap never lands on it — fact expo-device-bugs-checklist).
 */
export function useSnackbarOffset(px: number) {
  useFocusEffect(
    useCallback(() => {
      offset = px;
      emit();
      return () => {
        offset = null;
        emit();
      };
    }, [px]),
  );
}

/** Mounted once at the app root (app/_layout.tsx). */
export function SnackbarHost() {
  const s = useSyncExternalStore(subscribe, () => snack);
  const extra = useSyncExternalStore(subscribe, () => offset);
  const { colors, radius, size } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!s) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    AccessibilityInfo.announceForAccessibility(s.actionLabel ? `${s.message}. ${s.actionLabel}` : s.message);
    (async () => {
      const base = s.duration ?? 5000;
      let ms = base;
      try {
        if (await AccessibilityInfo.isScreenReaderEnabled()) ms = Math.max(base * 2, 10000);
        if (Platform.OS === 'android') ms = Math.max(ms, await AccessibilityInfo.getRecommendedTimeoutMillis(base));
      } catch {
        // keep base
      }
      if (!cancelled) timer = setTimeout(() => snack?.id === s.id && hideSnackbar(), ms);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [s]);

  if (!s) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 12 }]}>
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.snack,
          {
            backgroundColor: colors.ink,
            borderRadius: radius.md,
            marginBottom: insets.bottom + (extra ?? 16),
            maxWidth: size.contentMax - 24,
          },
        ]}
      >
        <Txt style={[font(500, 15, 20), { color: colors.surface0, flex: 1 }]}>{s.message}</Txt>
        {s.actionLabel ? (
          <Pressable
            hitSlop={12}
            onPress={() => {
              hideSnackbar();
              s.onAction?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={s.actionLabel}
            style={styles.snackAct}
          >
            <Txt style={[font(600, 15, 20), { color: colors.surface0, textDecorationLine: 'underline' }]}>{s.actionLabel}</Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  dialog: { width: '100%', maxWidth: 420, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  dialogIc: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  btnFlex: { flexGrow: 1, flexBasis: 100 },
  bottom: { flex: 1, justifyContent: 'flex-end' },
  sheetWrap: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  sheet: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 28, gap: 14, flexShrink: 1 },
  grabArea: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6, marginTop: -8, marginBottom: -4 },
  grab: { width: 40, height: 5, borderRadius: 3, opacity: 0.6, alignSelf: 'center' },
  sh: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: -8 },
  bigopt: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1 },
  bigIc: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  snack: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  snackAct: { minHeight: 24, justifyContent: 'center' },
});
