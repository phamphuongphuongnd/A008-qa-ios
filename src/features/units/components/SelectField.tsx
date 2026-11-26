/**
 * S-03 picker field (State, Bedrooms, Bathrooms): looks like a text field with a ▾, opens a sheet with the options.
 * Used only by 2A.
 */
import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { font, useTheme } from '@/theme';
import { FieldShell, ListGroup, ListRow, Sheet, Txt } from '@/ui';

import type { PickerOption } from '../screenModels';

export function SelectField<T extends string | number | null>({
  label,
  value,
  options,
  onChange,
  required,
  error,
  placeholder,
}: {
  label: string;
  value: T;
  options: readonly PickerOption<T>[];
  onChange: (v: T) => void;
  required?: boolean;
  error?: string | null;
  placeholder?: string;
}) {
  const { colors, radius } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <FieldShell label={label} required={required} error={error}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('units:s03.pickA11y', { label, value: current || placeholder || '' })}
        style={({ pressed }) => [
          styles.box,
          {
            borderRadius: radius.md,
            borderColor: error ? colors.danger : colors.lineStrong,
            backgroundColor: pressed ? colors.surface2 : colors.surface1,
          },
        ]}
      >
        <Txt style={[font(400, 16, 22), { flex: 1, color: current ? colors.ink : colors.inkMuted }]}>{current || placeholder || ''}</Txt>
        <ChevronDown size={20} color={colors.inkMuted} strokeWidth={1.8} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View>
          <ListGroup>
            {options.map((o) => (
              <ListRow
                key={String(o.value)}
                title={o.label}
                accessibilityLabel={o.label}
                right={o.value === value ? <Check size={20} color={colors.accent} strokeWidth={2.2} /> : undefined}
                chevron={false}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              />
            ))}
          </ListGroup>
        </View>
      </Sheet>
    </FieldShell>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 52, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
