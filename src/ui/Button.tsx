import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { fonts, radius, shade, size, state, useTheme, withAlpha, type Palette } from '@/theme';

import { Plus, type LucideIcon } from './icons';
import { Txt } from './Txt';

/**
 * ev.css buttons: primary `.btn` 52 · secondary `.btn.sec` 48 outline · text `.btn.txt` 44 · danger `.btn.dn` 52 red ·
 * small `.btn.sm` 36 pill (filled / outline / on-surface, as on Rentals' backup banner and S-09 issues).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'small' | 'smallOutline' | 'smallSurface';
/** Colour of `text`, `smallOutline` and `smallSurface` (default accent). */
export type ButtonTone = 'accent' | 'warning' | 'danger';
/** Gallery only: draw a state that normally needs a finger or a keyboard. */
export type DemoState = 'pressed' | 'focused';

export interface Look {
  bg: string;
  fg: string;
  /** Inset outline (secondary / small outline). */
  outline?: string;
  pressedBg: string;
  height: number;
  radius: number;
  padX: number;
  fontSize: number;
  minWidth?: number;
  shadow?: string;
}

function toneColor(c: Palette, tone: ButtonTone) {
  return tone === 'warning' ? c.warning : tone === 'danger' ? c.danger : c.accent;
}

export function buttonLook(v: ButtonVariant, c: Palette, tone: ButtonTone = 'accent'): Look {
  const tc = toneColor(c, tone);
  switch (v) {
    case 'primary':
      return { bg: c.accent, fg: c.onAccent, pressedBg: shade(c.accent, state.pressedDarken), height: size.buttonPrimary, radius: radius.button, padX: 20, fontSize: 16 };
    case 'secondary':
      return { bg: 'transparent', fg: c.accent, outline: c.accent, pressedBg: withAlpha(c.accent, 0.1), height: size.buttonSecondary, radius: radius.button, padX: 20, fontSize: 16 };
    case 'text':
      return { bg: 'transparent', fg: tc, pressedBg: withAlpha(tc, 0.1), height: size.buttonText, radius: radius.button, padX: 10, fontSize: 16 };
    case 'danger':
      return { bg: c.danger, fg: c.onDanger, pressedBg: shade(c.danger, state.pressedDarken), height: size.buttonPrimary, radius: radius.button, padX: 20, fontSize: 16 };
    case 'small':
      return { bg: c.accent, fg: c.onAccent, pressedBg: shade(c.accent, state.pressedDarken), height: size.buttonSmall, radius: radius.pill, padX: 14, fontSize: 14 };
    case 'smallOutline':
      return { bg: 'transparent', fg: tc, outline: tc, pressedBg: withAlpha(tc, 0.12), height: size.buttonSmall, radius: radius.pill, padX: 14, fontSize: 14 };
    case 'smallSurface':
      return { bg: c.surface, fg: tc, pressedBg: c.surface2, height: size.buttonSmall, radius: radius.pill, padX: 14, fontSize: 14 };
  }
}

export interface ButtonProps extends Pick<AccessibilityProps, 'accessibilityHint'> {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Spinner replaces the label, width kept, taps blocked. */
  loading?: boolean;
  /** Stretch to the container (footer buttons). */
  block?: boolean;
  accessibilityLabel?: string;
  demoState?: DemoState;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Button with the 5 states of mockup Components: Default · Pressed (darker, Android ripple on top) · Focused (2px accent
 * ring, 2px gap) · Disabled (38%, still announced) · Loading (spinner, same width, no second tap). Touch area ≥ 48.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  tone,
  icon: Icon,
  disabled,
  loading,
  block,
  accessibilityLabel,
  accessibilityHint,
  demoState,
  style,
  testID,
}: ButtonProps) {
  const { colors } = useTheme();
  const l = buttonLook(variant, colors, tone);
  return (
    <PressableBase
      look={l}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      block={block}
      demoState={demoState}
      style={style}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}>
      <View style={[styles.row, loading && styles.hidden]}>
        {Icon ? <Icon size={l.fontSize >= 16 ? 20 : 16} color={l.fg} strokeWidth={2.2} /> : null}
        <Txt style={{ color: l.fg, fontSize: l.fontSize, lineHeight: Math.round(l.fontSize * 1.3), fontFamily: fonts.semibold, textAlign: 'center', flexShrink: 1 }}>
          {label}
        </Txt>
      </View>
    </PressableBase>
  );
}

/** Header / toolbar icon (← · ⋯ · +): draws 44, touch 48 (ev.css `.ib`). `filled` = the accent "+" of Rentals. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  filled,
  color,
  demoState,
  style,
}: {
  icon: LucideIcon;
  /** Screen-reader label, e.g. "Back", "More actions", "New rental". */
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  filled?: boolean;
  color?: string;
  demoState?: DemoState;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const fg = color ?? (filled ? colors.onAccent : colors.text);
  const l: Look = {
    bg: filled ? colors.accent : 'transparent',
    fg,
    pressedBg: filled ? shade(colors.accent, state.pressedDarken) : colors.pressTint,
    height: size.iconButton,
    radius: size.iconButton / 2,
    padX: 0,
    fontSize: 15,
    minWidth: size.iconButton,
  };
  return (
    <PressableBase look={l} onPress={onPress} disabled={disabled} demoState={demoState} style={style} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={22} color={fg} strokeWidth={2.1} />
    </PressableBase>
  );
}

/** Floating action button 56 (ev.css `.fab`). */
export function Fab({ label, onPress, icon = Plus, style }: { label: string; onPress?: () => void; icon?: LucideIcon; style?: StyleProp<ViewStyle> }) {
  const { colors, shadows } = useTheme();
  const Icon = icon;
  const l: Look = { bg: colors.accent, fg: colors.onAccent, pressedBg: shade(colors.accent, state.pressedDarken), height: size.fab, radius: 16, padX: 0, fontSize: 15, minWidth: size.fab, shadow: shadows.fab };
  return (
    <PressableBase look={l} onPress={onPress} style={style} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={24} color={colors.onAccent} strokeWidth={2.4} />
    </PressableBase>
  );
}

/** Shared press / focus / disabled / loading behaviour for every tappable control of the kit. */
export function PressableBase({
  look: l,
  onPress,
  onLongPress,
  disabled,
  loading,
  block,
  demoState,
  style,
  contentStyle,
  testID,
  children,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  accessibilityValue,
}: {
  look: Look;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  demoState?: DemoState;
  style?: StyleProp<ViewStyle>;
  /** Extra style on the pressable box itself (alignment of a custom row). */
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  children: ReactNode;
} & Pick<AccessibilityProps, 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint' | 'accessibilityState' | 'accessibilityValue'>) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const blocked = !!disabled || !!loading;
  const slop = Math.max(0, Math.ceil((size.touch - l.height) / 2));
  const demoPressed = demoState === 'pressed';
  const ring = focused || demoState === 'focused';

  return (
    <View style={[styles.wrap, block ? styles.block : styles.inline, { opacity: disabled ? state.disabledOpacity : 1 }, style]}>
      <Pressable
        testID={testID}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={blocked}
        hitSlop={slop}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityValue={accessibilityValue}
        accessibilityState={{ disabled: blocked, busy: !!loading, ...accessibilityState }}
        android_ripple={blocked ? undefined : { color: withAlpha(l.fg.startsWith('#') ? l.fg : colors.text, state.rippleAlpha), foreground: true }}
        style={({ pressed }) => [
          styles.btn,
          {
            minHeight: l.height,
            minWidth: l.minWidth,
            paddingHorizontal: l.padX,
            borderRadius: l.radius,
            backgroundColor: (pressed || demoPressed) && !blocked ? l.pressedBg : l.bg,
            borderWidth: l.outline ? 1.5 : 0,
            borderColor: l.outline,
            boxShadow: l.shadow && !disabled ? l.shadow : undefined,
          },
          contentStyle,
        ]}>
        {children}
        {loading ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
            <ActivityIndicator size="small" color={l.fg} />
          </View>
        ) : null}
      </Pressable>
      {ring ? (
        <View
          pointerEvents="none"
          style={[styles.ring, { borderColor: colors.focusRing, borderRadius: l.radius + state.focusRing.offset + state.focusRing.width }]}
        />
      ) : null}
    </View>
  );
}

const RING = -(state.focusRing.offset + state.focusRing.width);

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  inline: { alignSelf: 'flex-start' },
  block: { alignSelf: 'stretch' },
  btn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  hidden: { opacity: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', top: RING, left: RING, right: RING, bottom: RING, borderWidth: state.focusRing.width },
});
