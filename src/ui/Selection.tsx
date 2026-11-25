import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, radius, size, useTheme } from '@/theme';

import { haptics } from './haptics';
import { Check } from './icons';
import { Txt } from './Txt';

// ---------------- Switch ----------------

/** ev.css `.sw` 50×30, touch 48. Ticks on change. With `label` it is a full settings row. */
export function Switch({
  value,
  onChange,
  label,
  hint,
  disabled,
  style,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  /** Screen-reader label (and visible text when the row is drawn). */
  label: string;
  hint?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, shadows } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled }}
      style={[styles.switchRow, disabled && styles.disabled, style]}>
      <View style={styles.grow}>
        <Txt weight="semibold">{label}</Txt>
        {hint ? <Txt v="hint">{hint}</Txt> : null}
      </View>
      <View style={[styles.track, { backgroundColor: value ? colors.accent : colors.border }]}>
        <View style={[styles.thumb, { backgroundColor: colors.thumb, left: value ? 23 : 3, boxShadow: shadows.thumb }]} />
      </View>
    </Pressable>
  );
}

// ---------------- Checkbox / Radio ----------------

/** ev.css `.cb` 24 box + text, the whole row toggles (consent lines, decision reasons, document checked). */
export function Checkbox({
  checked,
  onChange,
  label,
  children,
  disabled,
  style,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Text right of the box (also the screen-reader label). */
  label: string;
  /** Replaces the plain text (two-line reasons with a badge). Keep `label` for screen readers. */
  children?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      style={[styles.checkRow, disabled && styles.disabled, style]}>
      <View
        style={[
          styles.box,
          checked ? { backgroundColor: colors.accent } : { borderWidth: 2, borderColor: colors.text2 },
        ]}>
        {checked ? <Check size={16} color={colors.onAccent} strokeWidth={3} /> : null}
      </View>
      <View style={styles.grow}>{children ?? <Txt v="small">{label}</Txt>}</View>
    </Pressable>
  );
}

/** ev.css `.rad` 22 + text; one of a group (`RadioGroup` below sets the a11y group). */
export function Radio({ selected, onPress, label, hint, disabled }: { selected: boolean; onPress: () => void; label: string; hint?: string; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: selected, disabled }}
      style={[styles.checkRow, disabled && styles.disabled]}>
      <View style={[styles.radio, { borderColor: selected ? colors.accent : colors.text2 }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
      </View>
      <View style={styles.grow}>
        <Txt>{label}</Txt>
        {hint ? <Txt v="hint">{hint}</Txt> : null}
      </View>
    </Pressable>
  );
}

export function RadioGroup<T extends string>({ value, onChange, options, label }: { value: T | null; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[]; label: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 2 }}>
      {options.map((o) => (
        <Radio key={o.value} selected={value === o.value} onPress={() => onChange(o.value)} label={o.label} hint={o.hint} />
      ))}
    </View>
  );
}

// ---------------- Segmented ----------------

/** ev.css `.seg`: 2–3 equal options (Review mode, Open / Closed). Ticks on change. Wraps text at 200%. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** Screen-reader name of the group ("Review mode"). */
  label: string;
}) {
  const { colors, shadows } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.seg, { backgroundColor: colors.surface2 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (on) return;
              haptics.tick();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[styles.segBtn, on && { backgroundColor: colors.surface, boxShadow: shadows.segOn }]}>
            <Txt style={{ fontSize: 14, lineHeight: 18, fontFamily: fonts.semibold, color: on ? colors.text : colors.text2, textAlign: 'center' }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------- Option chips ----------------

export type OptionTone = 'accent' | 'danger';

/**
 * ev.css `.opts` / `.opt`: answer chips of the call scripts (Yes / No / Wouldn't say), decision kinds, pet types.
 * Single choice by default; `multiple` toggles each. `toneOf` paints a selected option red (S-15 "Deny").
 */
export function OptionChips<T extends string>({
  value,
  onChange,
  options,
  label,
  multiple,
  toneOf,
}: {
  value: T | T[] | null;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** Screen-reader name of the group (the question). */
  label: string;
  multiple?: boolean;
  toneOf?: (v: T) => OptionTone;
}) {
  const { colors } = useTheme();
  const isOn = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <View accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label} style={styles.opts}>
      {options.map((o) => {
        const on = isOn(o.value);
        const tone = toneOf?.(o.value) ?? 'accent';
        const [fg, bg] = tone === 'danger' ? [colors.danger, colors.dangerSoft] : [colors.accent, colors.accentSoft];
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            hitSlop={7}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityLabel={o.label}
            accessibilityState={{ checked: on }}
            style={[styles.opt, { borderColor: on ? fg : colors.border, backgroundColor: on ? bg : colors.surface }]}>
            <Txt style={{ fontSize: 13, lineHeight: 17, fontFamily: fonts.semibold, color: on ? fg : colors.text }}>{o.label}</Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: 2 },
  disabled: { opacity: 0.38 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: size.touch },
  track: { width: 50, height: 30, borderRadius: 15 },
  thumb: { position: 'absolute', top: 3, width: 24, height: 24, borderRadius: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: size.touch, paddingVertical: 12 },
  box: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  seg: { flexDirection: 'row', borderRadius: radius.seg, padding: 3, gap: 2 },
  segBtn: { flex: 1, minHeight: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4 },
  opts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: { minHeight: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
