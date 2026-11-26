/**
 * Small building blocks only the verify screens (S-11 … S-14) use, made from @/ui + @/theme (mockup v2 Indigo).
 */
import { FileQuestion } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { router } from '@/services/router';
import { font, useTheme } from '@/theme';
import { AppBar, Card, ChoicePills, EmptyState, FieldShell, IssueItem, IssuesCard, Screen, TextField, Txt, type Choice } from '@/ui';

import { monthInputText, parseMonthInput } from '../common';
import type { RedFlagView } from '../landlord';

import { errorText } from '../viewModels';

export { errorText, fieldError } from '../viewModels';

/** Numbered step card ("1 Find the real owner"): 28 px accent circle + 17/22 title. */
export function StepCard({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.stepH}>
        <View style={[styles.qnum, { backgroundColor: colors.accent }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Txt tabular style={[font(650, 14, 18), { color: colors.onAccent }]}>{String(n)}</Txt>
        </View>
        <Txt accessibilityRole="header" accessibilityLabel={t('verify:common.step', { n, title })} style={[font(650, 17, 22), { flex: 1 }]}>
          {title}
        </Txt>
      </View>
      {children}
    </Card>
  );
}

/** One call-script question: label + answer pills (single choice, tap again to clear). */
export function Question<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: readonly Choice<T>[];
  value: T | null;
  onChange: (v: T | null) => void;
  error?: string | null;
}) {
  return (
    <FieldShell label={label} error={error}>
      <ChoicePills options={options} value={value} onChange={(v) => onChange(v === value ? null : v)} accessibilityLabel={label} />
    </FieldShell>
  );
}

/** Month entry "MM/YYYY" (number pad). Commits "YYYY-MM" on blur; a wrong entry shows the error. */
export function MonthField({
  label,
  value,
  onCommit,
  error,
  disabled,
}: {
  label: string;
  value: string | null;
  onCommit: (ym: string | null) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const [text, setText] = useState(monthInputText(value));
  const [bad, setBad] = useState(false);
  const [last, setLast] = useState(value);
  if (last !== value) {
    // Value changed from outside (another field set it, data reloaded).
    setLast(value);
    setText(monthInputText(value));
  }
  return (
    <TextField
      label={label}
      value={text}
      placeholder={t('verify:common.monthPlaceholder')}
      keyboardType="numbers-and-punctuation"
      maxLength={7}
      disabled={disabled}
      error={bad ? errorText('month_invalid') : error}
      onChangeText={(s) => {
        setBad(false);
        setText(s.replace(/[^\d/]/g, ''));
      }}
      onBlur={() => {
        const ym = parseMonthInput(text);
        if (ym === undefined) setBad(true);
        else onCommit(ym);
      }}
    />
  );
}

/** "Red flags" warn card (S-11): one line per engine flag. Nothing when there are none. */
export function RedFlagsCard({ flags }: { flags: readonly RedFlagView[] }) {
  if (flags.length === 0) return null;
  return (
    <IssuesCard title={t('verify:landlord.redFlags')}>
      {flags.map((f) => (
        <IssueItem key={f.code} title={f.text} detail={f.detail} />
      ))}
    </IssuesCard>
  );
}

/** The applicant / record is gone (deleted, cleaned up, wrong link). */
export function NotFoundScreen({ title }: { title: string }) {
  return (
    <Screen header={<AppBar title={title} />}>
      <EmptyState
        icon={FileQuestion}
        title={t('verify:errors.notFound')}
        primary={{ label: t('common:actions.back'), onPress: () => router.back() }}
      />
    </Screen>
  );
}

/** Muted paragraph under a button / inside a card. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <Txt variant="caption" color="inkMuted">
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  stepH: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qnum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
