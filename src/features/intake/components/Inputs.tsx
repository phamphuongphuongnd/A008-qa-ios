/** Small inputs only intake uses: month ("MM / YYYY"), received date + time, Yes / No, add-file sources sheet. */
import { Camera, FileText, Image as ImageIcon } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';
import { Button, ChoicePills, DateField, ListGroup, ListRow, Sheet, TextField, Txt } from '@/ui';

import type { PickSource } from '../documents/picker';
import { formatMonthInput, parseMonthInput, parseTimeInput, receivedParts, withDateTime } from '../screenModels';

/** Month + year typed as "10 / 2024"; reports 'YYYY-MM' (or null) on blur. */
export function MonthField({
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (ym: string | null) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? formatMonthInput(value);
  return (
    <TextField
      label={label}
      value={shown}
      placeholder="MM / YYYY"
      keyboardType="number-pad"
      maxLength={9}
      disabled={disabled}
      error={error}
      onChangeText={(v) => {
        // Insert " / " after the month as the user types digits.
        const d = v.replace(/\D/g, '').slice(0, 6);
        setText(d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d);
      }}
      onBlur={() => {
        if (text == null) return;
        onChange(text.trim() === '' ? null : parseMonthInput(text));
        setText(null);
      }}
    />
  );
}

/** "Received on" (landlord, part 7): date picker + time text ("9:14 AM"); locked after saving. */
export function ReceivedField({
  value,
  onChange,
  editable,
  error,
  help,
}: {
  value: string;
  onChange: (ts: string) => void;
  editable: boolean;
  error?: string | null;
  help?: string;
}) {
  const p = receivedParts(value);
  const [timeText, setTimeText] = useState<string | null>(null);
  const [timeError, setTimeError] = useState(false);
  if (!editable)
    return (
      <View style={{ gap: 4 }}>
        <Txt variant="label">{t('intake:fields.receivedOn')}</Txt>
        <Txt variant="body" tabular>
          {p ? `${p.date} · ${p.time}` : value}
        </Txt>
        <Txt variant="caption" color="inkMuted">
          {t('intake:fields.receivedLocked')}
        </Txt>
      </View>
    );
  return (
    <View style={{ gap: 8 }}>
      <DateField label={t('intake:fields.receivedOn')} value={value.slice(0, 10)} onChange={(d) => onChange(withDateTime(value, d, null))} error={error} />
      <TextField
        label={t('intake:fields.time')}
        value={timeText ?? p?.time ?? ''}
        onChangeText={setTimeText}
        placeholder="9:14 AM"
        error={timeError ? t('intake:errors.receivedInvalid') : null}
        help={help}
        onBlur={() => {
          if (timeText == null) return;
          const tm = parseTimeInput(timeText);
          setTimeError(!tm);
          if (tm) {
            onChange(withDateTime(value, null, tm));
            setTimeText(null);
          }
        }}
      />
    </View>
  );
}

/** Yes / No pills (null = not answered). */
export function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="bodyStrong">{label}</Txt>
      <ChoicePills
        accessibilityLabel={label}
        options={[
          { value: 'no', label: t('intake:yesNo.no') },
          { value: 'yes', label: t('intake:yesNo.yes') },
        ]}
        value={value == null ? null : value ? 'yes' : 'no'}
        onChange={(v) => onChange(v === 'yes')}
      />
    </View>
  );
}

const SOURCE_ICON = { camera: Camera, library: ImageIcon, file: FileText } as const;
const SOURCE_LABEL: Record<PickSource, () => string> = {
  camera: () => t('intake:s10.camera'),
  library: () => t('intake:s10.library'),
  file: () => t('intake:s10.file'),
};

/** "Add proof of income" sheet: Take a photo · Choose from Photos · Choose a PDF (a denied camera is left out). */
export function AddSourceSheet({
  visible,
  title,
  sources,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  sources: readonly PickSource[];
  onPick: (s: PickSource) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} footer={<Button variant="ghost" block label={t('common:actions.cancel')} onPress={onClose} />}>
      <ListGroup>
        {sources.map((s) => (
          <ListRow key={s} title={SOURCE_LABEL[s]()} icon={SOURCE_ICON[s]} iconTone="accent" chevron onPress={() => onPick(s)} />
        ))}
      </ListGroup>
    </Sheet>
  );
}
