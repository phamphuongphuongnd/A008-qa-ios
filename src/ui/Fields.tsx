import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { formatDate } from '@/engine';
import { t } from '@/i18n';
import { font, useTheme } from '@/theme';

import { TextButton } from './Button';
import { Glyph } from './Glyph';
import { cleanMoneyTyping, editMoneyField, formatMoneyField, parseMoney } from './moneyInput';
import { Txt } from './Txt';

/** Forced look for the gallery; in the app focus comes from the input and error from `error`. */
export type FieldState = 'default' | 'focus' | 'error' | 'disabled';

interface ShellProps {
  label: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/** Label (+ "(required)") above, help or error (with icon, announced) below. */
export function FieldShell({ label, required, help, error, style, children }: ShellProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.field, style]}>
      <Txt variant="label" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
        {required ? <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{` ${t('ui:field.required')}`}</Txt> : null}
      </Txt>
      {children}
      {error ? (
        <View style={styles.err} accessibilityLiveRegion="polite">
          <Glyph name="alertCircle" size={16} color={colors.danger} />
          <Txt style={[font(500, 13, 18), { color: colors.danger, flex: 1 }]}>{error}</Txt>
        </View>
      ) : help ? (
        <Txt variant="caption" color="inkMuted" importantForAccessibility="no" accessibilityElementsHidden>
          {help}
        </Txt>
      ) : null}
    </View>
  );
}

/** Input box look: 50 high, radius 8, surface-1, 1.5 line-strong; focus 2 accent; error 2 danger. */
function useBoxStyle(focused: boolean, error: boolean, disabled: boolean, multiline?: boolean): ViewStyle {
  const { colors, radius } = useTheme();
  return {
    minHeight: multiline ? 88 : 50,
    borderRadius: radius.sm,
    backgroundColor: disabled ? colors.surface2 : colors.surface1,
    borderWidth: error || focused ? 2 : 1.5,
    borderColor: error ? colors.danger : focused ? colors.accent : colors.lineStrong,
    // Keep the text still when the border thickens.
    paddingHorizontal: error || focused ? 13.5 : 14,
    flexDirection: 'row',
    alignItems: multiline ? 'flex-start' : 'center',
    gap: 8,
  };
}

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label: string;
  required?: boolean;
  help?: string;
  error?: string | null;
  /** "$" before the value. */
  prefix?: string;
  /** "/mo", "%" after the value. */
  suffix?: string;
  disabled?: boolean;
  state?: FieldState;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  style?: StyleProp<ViewStyle>;
}

/** Text field (mockup Components › Form Field). Multiline = notes box (88 high). */
export function TextField({
  label,
  required,
  help,
  error,
  prefix,
  suffix,
  disabled,
  state,
  multiline,
  ref,
  style,
  onFocus,
  onBlur,
  ...input
}: TextFieldProps) {
  const { colors, type } = useTheme();
  const [focused, setFocused] = useState(false);
  const isError = !!error || state === 'error';
  const isDisabled = disabled || state === 'disabled';
  const box = useBoxStyle(focused || state === 'focus', isError, !!isDisabled, multiline);
  return (
    <FieldShell label={label} required={required} help={help} error={error} style={style}>
      <View style={box}>
        {prefix ? <Txt style={[type.body, { color: colors.inkMuted }]}>{prefix}</Txt> : null}
        <TextInput
          ref={ref}
          {...input}
          multiline={multiline}
          editable={!isDisabled}
          accessibilityLabel={input.accessibilityLabel ?? (required ? `${label}, ${t('ui:field.required')}` : label)}
          accessibilityHint={error ?? help}
          accessibilityState={{ disabled: !!isDisabled }}
          placeholderTextColor={colors.inkMuted}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            type.body,
            styles.input,
            { color: isDisabled ? colors.inkMuted : colors.ink, fontVariant: ['tabular-nums'] },
            multiline && styles.multi,
          ]}
        />
        {suffix ? <Txt style={[type.body, { color: colors.inkMuted }]}>{suffix}</Txt> : null}
      </View>
    </FieldShell>
  );
}

export interface MoneyFieldProps extends Omit<TextFieldProps, 'value' | 'onChangeText' | 'keyboardType' | 'prefix'> {
  /** Integer cents (null = empty). */
  cents: number | null;
  onChangeCents: (cents: number | null) => void;
}

/**
 * USD amount in integer cents. Number keyboard, 2 decimals; shows "1,650.00" when not focused, the bare number while
 * editing. An unreadable amount shows the built-in error until fixed (the screen's own `error` wins).
 */
export function MoneyField({ cents, onChangeCents, error, onFocus, onBlur, ...rest }: MoneyFieldProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const text = editing ?? formatMoneyField(cents);
  return (
    <TextField
      {...rest}
      prefix="$"
      keyboardType="decimal-pad"
      inputMode="decimal"
      value={text}
      error={error ?? bad}
      onFocus={(e) => {
        setEditing(editMoneyField(cents));
        onFocus?.(e);
      }}
      onChangeText={(s) => {
        const clean = cleanMoneyTyping(s);
        setEditing(clean);
        const p = parseMoney(clean);
        setBad(p.error === 'tooLarge' ? t('ui:money.tooLarge') : null);
        if (!p.error) onChangeCents(p.cents);
      }}
      onBlur={(e) => {
        setEditing(null);
        onBlur?.(e);
      }}
    />
  );
}

/** 'YYYY-MM-DD' ⇄ local Date (no time-zone shift). */
const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Date field: shows "Dec 2, 2026"; opens the system date picker (Android dialog, iOS inline calendar in a sheet). */
export function DateField({
  label,
  value,
  onChange,
  required,
  help,
  error,
  placeholder,
  minimumDate,
  maximumDate,
  disabled,
  state,
  style,
}: {
  label: string;
  /** 'YYYY-MM-DD' or null. */
  value: string | null;
  onChange: (iso: string) => void;
  required?: boolean;
  help?: string;
  error?: string | null;
  placeholder?: string;
  minimumDate?: string;
  maximumDate?: string;
  disabled?: boolean;
  state?: FieldState;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, type, dark, radius } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());
  const isError = !!error || state === 'error';
  const isDisabled = disabled || state === 'disabled';
  const box = useBoxStyle(state === 'focus' || iosOpen, isError, !!isDisabled);
  const initial = value ? toDate(value) : new Date();
  const min = minimumDate ? toDate(minimumDate) : undefined;
  const max = maximumDate ? toDate(maximumDate) : undefined;

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toIso(date));
        },
      });
    } else {
      setIosDraft(initial);
      setIosOpen(true);
    }
  };

  return (
    <FieldShell label={label} required={required} help={help} error={error} style={style}>
      <Pressable
        onPress={open}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}${required ? `, ${t('ui:field.required')}` : ''}, ${value ? formatDate(value) : t('ui:date.notSet')}`}
        accessibilityHint={error ?? help ?? t('ui:date.hint')}
        accessibilityState={{ disabled: !!isDisabled }}
        style={box}
      >
        <Txt tabular style={[type.body, { flex: 1, color: value && !isDisabled ? colors.ink : colors.inkMuted }]}>
          {value ? formatDate(value) : (placeholder ?? t('ui:date.placeholder'))}
        </Txt>
        <CalendarDays color={colors.inkMuted} size={20} strokeWidth={1.8} />
      </Pressable>
      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]} onPress={() => setIosOpen(false)} accessibilityLabel={t('common:actions.cancel')} />
          <View style={[styles.iosSheet, { backgroundColor: colors.surface1, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            <View style={styles.iosBar}>
              <TextButton label={t('common:actions.cancel')} tone="muted" onPress={() => setIosOpen(false)} />
              <TextButton
                label={t('common:actions.done')}
                onPress={() => {
                  setIosOpen(false);
                  onChange(toIso(iosDraft));
                }}
              />
            </View>
            <DateTimePicker
              value={iosDraft}
              mode="date"
              display="inline"
              themeVariant={dark ? 'dark' : 'light'}
              accentColor={colors.accent}
              minimumDate={min}
              maximumDate={max}
              onChange={(_, d) => d && setIosDraft(d)}
            />
          </View>
        </Modal>
      ) : null}
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  err: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { flex: 1, minHeight: 46, paddingVertical: 10, paddingHorizontal: 0 },
  multi: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  iosSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 32 },
  iosBar: { flexDirection: 'row', justifyContent: 'space-between' },
});
