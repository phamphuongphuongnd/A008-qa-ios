import { useState, type ComponentType, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type AccessibilityProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { font, useTheme, withAlpha, type Theme } from '@/theme';

import { TOUCH_MIN } from './touch';
import { Txt } from './Txt';

/** Any icon component taking color + size (lucide-react-native icons fit). */
export type IconComponent = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'dangerOutline';
/** Forced visual state (gallery / screenshots). In the app the state comes from touch, focus, disabled, loading. */
export type ButtonState = 'default' | 'pressed' | 'focused' | 'disabled' | 'loading';

export interface ButtonProps extends Pick<AccessibilityProps, 'accessibilityLabel' | 'accessibilityHint'> {
  label: string;
  onPress?: () => void;
  /** primary (52 high) · secondary / tonal / ghost / danger / dangerOutline (48 high). */
  variant?: ButtonVariant;
  /** sm = 40 high (inline actions; the touch area still reaches 48). */
  size?: 'md' | 'sm';
  icon?: IconComponent;
  /** Full width. */
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  /** Label while loading ("Saving…"); default = label. */
  loadingLabel?: string;
  state?: ButtonState;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

function colorsFor(t: Theme, variant: ButtonVariant, pressed: boolean) {
  const c = t.colors;
  switch (variant) {
    case 'primary':
      return { bg: pressed ? c.accentPressed : c.accent, fg: c.onAccent, border: undefined };
    case 'secondary':
      return { bg: c.surface1, fg: c.accent, border: c.lineStrong };
    case 'tonal':
      return { bg: c.accentSoft, fg: c.accent, border: undefined };
    case 'ghost':
      return { bg: 'transparent', fg: c.accent, border: undefined };
    case 'danger':
      return { bg: c.danger, fg: c.onDanger, border: undefined };
    case 'dangerOutline':
      return { bg: c.surface1, fg: c.danger, border: c.danger };
  }
}

/** 2 px focus ring, 3 px outside the control (design: outline 2px focus, offset 3px). Never shifts layout. */
export function FocusRing({ visible, radius, children }: { visible: boolean; radius: number; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        margin: -5,
        padding: 3,
        borderWidth: 2,
        borderRadius: radius + 5,
        borderColor: visible ? colors.focus : 'transparent',
      }}
    >
      {children}
    </View>
  );
}

/**
 * Button (mockup Components › Button). Five states: default, pressed, focused (keyboard / switch access), disabled,
 * loading (spinner + loadingLabel, not pressable, announced busy). Labels wrap instead of clipping at 200 % text.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  block,
  disabled,
  loading,
  loadingLabel,
  state,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const isLoading = loading || state === 'loading';
  const isDisabled = disabled || state === 'disabled';
  const sm = size === 'sm';
  const minHeight = sm ? 40 : variant === 'primary' ? t.size.buttonPrimaryH : t.size.buttonSecondaryH;
  const radius = sm ? 10 : t.radius.md;
  // B-75: the pressable (= accessibility frame) is never under 48; a small button keeps its 40 look inside it.
  const frame = Math.max(minHeight, TOUCH_MIN);

  return (
    <View style={[block ? styles.block : styles.inline, style]}>
      <FocusRing visible={focused || state === 'focused'} radius={radius}>
        <Pressable
          onPress={onPress}
          disabled={isDisabled || isLoading}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: !!(isDisabled || isLoading), busy: !!isLoading }}
          testID={testID}
          style={{ minHeight: frame, justifyContent: 'center' }}
        >
          {({ pressed }) => {
            const p = pressed || state === 'pressed';
            const v = isDisabled ? null : colorsFor(t, variant, p);
            const fg = isDisabled ? t.colors.inkMuted : colorsFor(t, variant, p).fg;
            return (
              <View
                style={[
                  styles.btn,
                  {
                    minHeight,
                    borderRadius: radius,
                    paddingHorizontal: sm ? 14 : variant === 'ghost' ? 12 : 20,
                    backgroundColor: v ? v.bg : t.colors.surface2,
                    borderWidth: v?.border ? 1.5 : 0,
                    borderColor: v?.border,
                  },
                ]}
              >
                {/* Pressed state layer for the non-primary variants (primary switches to accent-pressed). */}
                {p && !isDisabled && variant !== 'primary' ? (
                  <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: withAlpha(fg, 0.1) }]}
                  />
                ) : null}
                {isLoading ? (
                  <ActivityIndicator size={18} color={fg} />
                ) : Icon ? (
                  <Icon color={fg} size={20} strokeWidth={1.8} />
                ) : null}
                <Txt
                  style={[sm ? font(600, 15, 20) : font(600, 16, 20), { color: fg, textAlign: 'center', flexShrink: 1 }]}
                >
                  {isLoading ? (loadingLabel ?? label) : label}
                </Txt>
              </View>
            );
          }}
        </Pressable>
      </FocusRing>
    </View>
  );
}

/** Round 44 icon button (app bars, sheet close) in a 48 touch / accessibility frame (B-75). Always needs an accessibilityLabel. */
export function IconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  tone = 'plain',
  disabled,
  testID,
}: {
  icon: IconComponent;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: 'plain' | 'accent' | 'filled';
  disabled?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const fg = tone === 'filled' ? t.colors.onAccent : tone === 'accent' ? t.colors.accent : t.colors.ink;
  return (
    <FocusRing visible={focused} radius={24}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
        testID={testID}
        style={[styles.iconFrame, { opacity: disabled ? 0.4 : 1 }]}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.icon,
              {
                backgroundColor:
                  tone === 'filled' ? (pressed ? t.colors.accentPressed : t.colors.accent) : pressed ? withAlpha(t.colors.ink, 0.08) : 'transparent',
              },
            ]}
          >
            <Icon color={fg} size={22} strokeWidth={1.8} />
          </View>
        )}
      </Pressable>
    </FocusRing>
  );
}

/** Text link button ("Edit", "Clear", "Skip"): 16 semibold accent, 48 high (B-75). */
export function TextButton({
  label,
  onPress,
  tone = 'accent',
  disabled,
  accessibilityLabel,
  testID,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'accent' | 'danger' | 'muted';
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const t = useTheme();
  const color = disabled ? t.colors.inkMuted : tone === 'danger' ? t.colors.danger : tone === 'muted' ? t.colors.inkMuted : t.colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [styles.text, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Txt style={[font(600, 16, 24), { color }]}>{label}</Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: 'stretch' },
  inline: { alignSelf: 'flex-start' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, overflow: 'hidden' },
  iconFrame: { width: TOUCH_MIN, height: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  text: { minHeight: TOUCH_MIN, paddingHorizontal: 4, justifyContent: 'center' },
});
