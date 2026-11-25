import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useEffect, useReducer, useRef, useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { t } from '@/i18n';
import { fonts, layout, radius, size, useTheme } from '@/theme';

import { Button } from './Button';
import { centsToInput, cleanMoneyTyped, dayKey, formatDay, formatMonth, monthKey, parseCents, parseKey } from './format';
import { Calendar, CircleAlert } from './icons';
import { modalFocusDelay, useModalShown } from './modalShown';
import { Sheet } from './Overlays';
import { Txt } from './Txt';

type InputRef = ComponentRef<typeof TextInput>;

export interface FieldChrome {
  label: string;
  /** Grey line under the field ("Gross = before taxes."). */
  hint?: string;
  /** Red, blocks Save. Set it when leaving the field and on Save — never while typing. */
  error?: string | null;
  disabled?: boolean;
  /** Wrapper view — measure it to scroll to the first error on Save. */
  fieldRef?: Ref<ComponentRef<typeof View>>;
  /** Gallery only: draw the focused look. */
  demoFocused?: boolean;
}

/** Label · box · hint / error (ev.css `.fld` `.in` `.errt`). Box: 1px border; focused 2px accent; error 2px danger. */
export function FieldShell({
  label,
  hint,
  error,
  disabled,
  focused,
  fieldRef,
  multiline,
  children,
  onPressBox,
  boxA11y,
}: FieldChrome & { focused?: boolean; multiline?: boolean; children: ReactNode; onPressBox?: () => void; boxA11y?: object }) {
  const { colors } = useTheme();
  const thick = !!error || !!focused;
  const box = (
    <View
      style={[
        styles.box,
        multiline && styles.multi,
        {
          backgroundColor: colors.surface,
          borderColor: error ? colors.danger : focused ? colors.accent : colors.border,
          borderWidth: thick ? 2 : 1,
          // Keep the text still when the border thickens.
          paddingHorizontal: thick ? 13 : 14,
        },
      ]}>
      {children}
    </View>
  );
  return (
    <View ref={fieldRef} style={[styles.field, disabled && { opacity: 0.6 }]}>
      <Txt v="label">{label}</Txt>
      {onPressBox ? (
        <Pressable onPress={onPressBox} disabled={disabled} android_ripple={{ color: colors.pressTint, foreground: true }} {...boxA11y}>
          {box}
        </Pressable>
      ) : (
        box
      )}
      {error ? (
        <View style={styles.msg} accessibilityLiveRegion="polite">
          <CircleAlert size={14} color={colors.danger} strokeWidth={2.4} />
          <Txt v="hint" weight="semibold" c="danger" style={{ flex: 1 }}>
            {error}
          </Txt>
        </View>
      ) : hint ? (
        <Txt v="hint">{hint}</Txt>
      ) : null}
    </View>
  );
}

/** B-149 (A006): autoFocus inside a Sheet / Dialog on Android waits for the Modal window. */
function useModalAutoFocus(input: React.RefObject<InputRef | null>, autoFocus?: boolean) {
  const modalShown = useModalShown();
  const defer = Platform.OS === 'android' && !!autoFocus && modalShown !== null;
  useEffect(() => {
    if (!defer || !modalShown) return;
    const id = setTimeout(() => input.current?.focus(), modalFocusDelay());
    return () => clearTimeout(id);
  }, [defer, modalShown, input]);
  return defer ? false : autoFocus;
}

const inputText = { fontSize: 16, fontFamily: fonts.regular } as const;

// ---------------- Text ----------------

export interface TextFieldProps extends FieldChrome {
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
  /** Shows "12/80" under the field. */
  maxLength?: number;
  /** keyboardType, autoComplete, textContentType, returnKeyType… */
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'multiline' | 'maxLength'>;
  /** Receives the TextInput (focus the next field, scroll to an error): `inputRef={(n) => (ref.current = n)}`. */
  inputRef?: (node: InputRef | null) => void;
}

/** Text field (name, phone, email, notes). `multiline` grows from 3 lines. */
export function TextField({ value, onChangeText, onBlur, placeholder, autoFocus, multiline, maxLength, inputProps, inputRef, ...chrome }: TextFieldProps) {
  const { colors } = useTheme();
  const inner = useRef<InputRef | null>(null);
  const [focused, setFocused] = useState(false);
  const af = useModalAutoFocus(inner, autoFocus);
  return (
    <FieldShell {...chrome} multiline={multiline} focused={focused || chrome.demoFocused} hint={maxLength && !chrome.hint ? `${value.length}/${maxLength}` : chrome.hint}>
      <TextInput
        ref={(node) => {
          inner.current = node;
          inputRef?.(node);
        }}
        value={value}
        onChangeText={onChangeText}
        editable={!chrome.disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.text2}
        autoFocus={af}
        multiline={multiline}
        maxLength={maxLength}
        accessibilityLabel={chrome.label}
        accessibilityHint={chrome.error ?? chrome.hint}
        maxFontSizeMultiplier={layout.maxFontScale}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        {...inputProps}
        style={[styles.input, inputText, multiline && styles.multiInput, { color: colors.text }]}
      />
    </FieldShell>
  );
}

// ---------------- Money (USD, integer cents) ----------------

export interface MoneyFieldProps extends FieldChrome {
  /** Integer cents; null = empty. */
  value: number | null;
  onChange: (cents: number | null) => void;
  /** Validate here (product.md §5.0: on leaving the field and on Save). */
  onBlur?: () => void;
  /** After the amount, e.g. "/mo". */
  unit?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Receives the TextInput (focus the next field, scroll to an error): `inputRef={(n) => (ref.current = n)}`. */
  inputRef?: (node: InputRef | null) => void;
}

/**
 * USD field: decimal pad, at most 2 decimals, commas added when it loses focus and removed while editing, pasted
 * "$1,234.50" → 123450 cents, a filled field is selected on focus. The value is exactly what was typed — never rounded.
 */
export function MoneyField({ value, onChange, onBlur, unit, placeholder = '0', autoFocus, inputRef, ...chrome }: MoneyFieldProps) {
  const { colors } = useTheme();
  const inner = useRef<InputRef | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const af = useModalAutoFocus(inner, autoFocus);
  const focused = editing !== null || !!chrome.demoFocused;
  const text = editing ?? centsToInput(value, true);
  const selectAll = useRef(false);

  useEffect(() => {
    if (editing !== null && selectAll.current) {
      selectAll.current = false;
      if (editing.length > 0) inner.current?.setSelection(0, editing.length);
    }
  }, [editing]);

  const a11yValue = text ? `$${text}${unit ? ` ${unit}` : ''}` : t('ui:field.empty');

  return (
    <FieldShell {...chrome} focused={focused}>
      <Txt c={text ? 'text' : 'text2'} num style={[inputText, styles.affix]} accessible={false}>
        $
      </Txt>
      <TextInput
        ref={(node) => {
          inner.current = node;
          inputRef?.(node);
        }}
        value={text}
        onChangeText={(raw) => {
          const cleaned = cleanMoneyTyped(raw);
          if (cleaned === null) {
            bump(); // refused: TextInput gets the previous text back
            return;
          }
          setEditing(cleaned);
          onChange(parseCents(cleaned));
        }}
        editable={!chrome.disabled}
        keyboardType="decimal-pad"
        inputMode="decimal"
        autoCorrect={false}
        autoComplete="off"
        placeholder={placeholder}
        placeholderTextColor={colors.text2}
        autoFocus={af}
        accessibilityLabel={chrome.label}
        accessibilityValue={{ text: a11yValue }}
        accessibilityHint={chrome.error ?? chrome.hint}
        maxFontSizeMultiplier={layout.maxFontScale}
        onFocus={() => {
          selectAll.current = true;
          setEditing(centsToInput(value, false));
        }}
        onBlur={() => {
          setEditing(null);
          onBlur?.();
        }}
        style={[styles.input, inputText, { color: colors.text, fontVariant: ['tabular-nums'] }]}
      />
      {unit ? (
        <Txt v="secondary" accessible={false}>
          {unit}
        </Txt>
      ) : null}
    </FieldShell>
  );
}

// ---------------- Date / month ----------------

export interface DateFieldProps extends FieldChrome {
  /** 'YYYY-MM-DD' (mode day) or 'YYYY-MM' (mode month); null = not set. */
  value: string | null;
  onChange: (v: string | null) => void;
  mode?: 'day' | 'month';
  minimum?: Date;
  maximum?: Date;
  /** "Clear" under the field when set (optional dates). */
  clearable?: boolean;
  placeholder?: string;
}

/**
 * Day / month field that opens the platform picker: Android the Material date dialog, iOS a wheel in a sheet with
 * Done (Components: "Date picker"). For a month the picked day is ignored.
 */
export function DateField({ value, onChange, mode = 'day', minimum, maximum, clearable, placeholder, ...chrome }: DateFieldProps) {
  const { colors, dark } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => (value ? parseKey(value) : new Date()));
  const shown = value ? (mode === 'month' ? formatMonth(value) : formatDay(value)) : null;
  const toKey = (d: Date) => (mode === 'month' ? monthKey(d) : dayKey(d));

  const open = () => {
    const start = value ? parseKey(value) : (minimum ?? new Date());
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: start,
        mode: 'date',
        minimumDate: minimum,
        maximumDate: maximum,
        onChange: (e, d) => {
          if (e.type === 'set' && d) onChange(toKey(d));
        },
      });
    } else {
      setDraft(start);
      setIosOpen(true);
    }
  };

  return (
    <View style={styles.field}>
      <FieldShell
        {...chrome}
        focused={iosOpen || chrome.demoFocused}
        onPressBox={open}
        boxA11y={{
          accessibilityRole: 'button',
          accessibilityLabel: chrome.label,
          accessibilityValue: { text: shown ?? t('ui:field.empty') },
          accessibilityHint: chrome.error ?? chrome.hint ?? t('ui:field.chooseDate'),
          accessibilityState: { disabled: !!chrome.disabled },
        }}>
        <Txt num c={shown ? 'text' : 'text2'} style={[inputText, { flex: 1 }]}>
          {shown ?? placeholder ?? t('ui:field.chooseDate')}
        </Txt>
        <Calendar size={18} color={colors.text2} strokeWidth={2} />
      </FieldShell>
      {clearable && value && !chrome.disabled ? (
        <Button variant="text" label={t('ui:field.clear')} accessibilityLabel={`${t('ui:field.clear')} ${chrome.label}`} onPress={() => onChange(null)} />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Sheet
          visible={iosOpen}
          onClose={() => setIosOpen(false)}
          title={chrome.label}
          scroll={false}
          footer={
            <Button
              block
              label={t('common:actions.done')}
              onPress={() => {
                setIosOpen(false);
                onChange(toKey(draft));
              }}
            />
          }>
          <DateTimePicker
            value={draft}
            mode="date"
            display="spinner"
            minimumDate={minimum}
            maximumDate={maximum}
            onChange={(_e, d) => d && setDraft(d)}
            themeVariant={dark ? 'dark' : 'light'}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  box: { minHeight: size.input, borderRadius: radius.input, flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  multi: { alignItems: 'flex-start', paddingVertical: 10 },
  input: { flex: 1, minHeight: size.input - 4, paddingVertical: 0 },
  multiInput: { minHeight: 72, textAlignVertical: 'top' },
  affix: { marginRight: 2 },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
