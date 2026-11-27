import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { t } from '@/i18n';
import { font, useTheme, withAlpha } from '@/theme';

import { Glyph } from './Glyph';
import { haptics } from './haptics';
import { TOUCH_MIN } from './touch';
import { Txt } from './Txt';

export interface Choice<T extends string> {
  value: T;
  label: string;
  /** Spoken instead of label. */
  accessibilityLabel?: string;
}

/** Segmented control (Review mode, Compare / First-come…). Tick haptic on change. Labels wrap at large text. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  style,
}: {
  options: readonly Choice<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Name of the whole control ("Review mode"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.seg, { backgroundColor: colors.surface2, borderRadius: radius.md }, style]}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          // B-75: each option's frame is the full 48 track height; the 42 pill is drawn inside it (track padding 3).
          <Pressable
            key={o.value}
            onPress={() => {
              if (!on) {
                haptics.tick();
                onChange(o.value);
              }
            }}
            accessibilityRole="radio"
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ checked: on, selected: on }}
            style={[styles.segFrame, { paddingLeft: i === 0 ? 3 : 1, paddingRight: i === options.length - 1 ? 3 : 1 }]}
          >
            <View
              style={[
                styles.segItem,
                on && {
                  backgroundColor: colors.surface1,
                  borderWidth: 1,
                  borderColor: colors.line,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                },
              ]}
            >
              <Txt align="center" style={[font(on ? 600 : 500, 14, 20), { color: on ? colors.ink : colors.inkMuted }]}>
                {o.label}
              </Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Choice pills (40 high, in a 48 touch frame — B-75): single choice (`value`) or several (`values`). Selected = solid accent. */
export function ChoicePills<T extends string>({
  options,
  value,
  values,
  onChange,
  onToggle,
  accessibilityLabel,
}: {
  options: readonly Choice<T>[];
  value?: T | null;
  values?: readonly T[];
  onChange?: (v: T) => void;
  onToggle?: (v: T, on: boolean) => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const multi = values !== undefined;
  return (
    <View accessibilityRole={multi ? undefined : 'radiogroup'} accessibilityLabel={accessibilityLabel} style={styles.pills}>
      {options.map((o) => {
        const on = multi ? values.includes(o.value) : o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptics.tick();
              if (multi) onToggle?.(o.value, !on);
              else if (!on) onChange?.(o.value);
            }}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            accessibilityState={{ checked: on }}
            style={styles.pillFrame}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.pill,
                  on
                    ? { backgroundColor: pressed ? colors.accentPressed : colors.accent }
                    : { backgroundColor: pressed ? colors.surface2 : colors.surface1, borderWidth: 1.5, borderColor: colors.lineStrong },
                ]}
              >
                {on && multi ? <Glyph name="check" size={16} color={colors.onAccent} strokeWidth={2.4} /> : null}
                <Txt style={[font(500, 14, 20), { color: on ? colors.onAccent : colors.ink }]}>{o.label}</Txt>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Toggle 52×32 (mockup Controls › Toggle). Control only — give it a label, or use SwitchRow. */
export function Switch({
  value,
  onChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.switchFrame, { opacity: disabled ? 0.45 : 1 }]}
    >
      <SwitchTrack on={value} />
    </Pressable>
  );
}

function SwitchTrack({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.track,
        on ? { backgroundColor: colors.accent } : { backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.lineStrong },
      ]}
    >
      <View
        style={
          on
            ? { position: 'absolute', left: 24, top: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.onAccent }
            : { position: 'absolute', left: 4, top: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.lineStrong }
        }
      />
    </View>
  );
}

/** Row with title (+ description) and a toggle; the whole row is the switch (one stop for screen readers). */
export function SwitchRow({
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t2 = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={({ pressed }) => [styles.switchRow, pressed && { backgroundColor: withAlpha(t2.colors.ink, 0.05) }, { opacity: disabled ? 0.45 : 1 }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={font(500, 16, 22)}>{title}</Txt>
        {description ? <Txt variant="caption" color="inkMuted">{description}</Txt> : null}
      </View>
      <SwitchTrack on={value} />
    </Pressable>
  );
}

function Box({ on, size = 24 }: { on: boolean; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
        on ? { backgroundColor: colors.accent } : { backgroundColor: colors.surface1, borderWidth: 2, borderColor: colors.lineStrong },
      ]}
    >
      {on ? <Glyph name="check" size={size - 6} color={colors.onAccent} strokeWidth={2.6} /> : null}
    </View>
  );
}

function Radio({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: on ? 7 : 2,
        borderColor: on ? colors.accent : colors.lineStrong,
        backgroundColor: colors.surface1,
      }}
    />
  );
}

/** Checkbox with its label (consent lines). The whole line toggles. */
export function Checkbox({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.check, { opacity: disabled ? 0.45 : 1 }]}
    >
      <Box on={value} />
      <Txt style={[font(400, 15, 22), { flex: 1 }]}>{label}</Txt>
    </Pressable>
  );
}

/** Option card with radio (one of) or checkbox (any of): title + description; selected = accent edge + soft fill. */
export function OptionCard({
  kind = 'radio',
  title,
  description,
  selected,
  onPress,
  disabled,
}: {
  kind?: 'radio' | 'checkbox';
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole={kind}
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      style={[
        styles.option,
        { borderRadius: radius.md, opacity: disabled ? 0.45 : 1 },
        selected
          ? { backgroundColor: colors.accentSoft, borderWidth: 2, borderColor: colors.accent, padding: 13.5 }
          : { backgroundColor: colors.surface1, borderWidth: 1.5, borderColor: colors.line },
      ]}
    >
      <View style={{ marginTop: 1 }}>{kind === 'radio' ? <Radio on={selected} /> : <Box on={selected} size={22} />}</View>
      <View style={{ flex: 1 }}>
        <Txt style={font(600, 15, 20)}>{title}</Txt>
        {description ? (
          <Txt variant="caption" color="inkMuted" style={{ marginTop: 2 }}>
            {description}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** − value + (criteria multipliers "3.0×", counts). Adjustable for screen readers (swipe up / down). */
export function Stepper({
  display,
  onDecrement,
  onIncrement,
  canDecrement = true,
  canIncrement = true,
  accessibilityLabel,
}: {
  display: string;
  onDecrement: () => void;
  onIncrement: () => void;
  canDecrement?: boolean;
  canIncrement?: boolean;
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  const side = (sign: '−' | '+', on: boolean, fn: () => void) => (
    <Pressable
      onPress={fn}
      disabled={!on}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={({ pressed }) => [styles.stepBtn, pressed && { backgroundColor: colors.surface2 }]}
    >
      <Txt style={[font(500, 20, 24), { color: on ? colors.accent : colors.inkMuted }]}>{sign}</Txt>
    </Pressable>
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: display }}
      accessibilityActions={[
        { name: 'increment', label: t('ui:stepper.increase') },
        { name: 'decrement', label: t('ui:stepper.decrease') },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment' && canIncrement) onIncrement();
        if (e.nativeEvent.actionName === 'decrement' && canDecrement) onDecrement();
      }}
      style={[styles.stepper, { backgroundColor: colors.surface1, borderColor: colors.lineStrong }]}
    >
      {side('−', canDecrement, onDecrement)}
      <View style={[styles.stepVal, { borderColor: colors.line }]}>
        <Txt tabular style={font(600, 15, 20)}>
          {display}
        </Txt>
      </View>
      {side('+', canIncrement, onIncrement)}
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row' },
  segFrame: { flex: 1, minHeight: TOUCH_MIN, paddingVertical: 3 },
  segItem: { flex: 1, minHeight: 42, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  // Rows of 48 frames around 40 pills: the 8 between rows comes from the frames.
  pills: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  pillFrame: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  pill: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchFrame: { minHeight: TOUCH_MIN, minWidth: TOUCH_MIN, justifyContent: 'center', alignItems: 'center' },
  track: { width: 52, height: 32, borderRadius: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, minHeight: 48, paddingVertical: 4 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  stepper: { flexDirection: 'row', alignItems: 'stretch', alignSelf: 'flex-start', minHeight: TOUCH_MIN, borderRadius: 10, borderWidth: 1.5, overflow: 'hidden' },
  stepBtn: { width: TOUCH_MIN, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 56, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderRightWidth: 1 },
});
