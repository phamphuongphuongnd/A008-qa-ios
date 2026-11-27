import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import type { Evidence, Outcome } from '@/engine';
import { t } from '@/i18n';
import { font, useTheme, withAlpha } from '@/theme';

import { Avatar, BadgeRow, Chip, EvidenceTag, QueueNumber, StatusBadge, evidenceLabel, outcomeLabel, type ChipTone } from './Badges';
import { type IconComponent } from './Button';
import { Card, useCardStyle } from './Card';
import { Glyph } from './Glyph';
import { TOUCH_MIN } from './touch';
import { Txt } from './Txt';

/** Bold ink run inside a muted reason line: <Txt>…<B>$5,351.67/mo</B> is <B>3.24×</B> rent</Txt>. */
export function B({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  // Plain Text so size / line height come from the parent run.
  return <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.ink }}>{children}</Text>;
}

function usePressBg() {
  const t2 = useTheme();
  return withAlpha(t2.colors.ink, t2.dark ? 0.12 : 0.05);
}

/** One criterion's result (S-09, S-17 at large text): name, Outcome + Evidence badges, reason. Use inside ListGroup. */
export function CriterionRow({
  name,
  outcome,
  evidence,
  reason,
  onPress,
  accessibilityLabel,
}: {
  name: string;
  outcome: Outcome;
  evidence?: Evidence;
  /** String or Txt runs with <B>. */
  reason?: ReactNode;
  onPress?: () => void;
  /** Default: name, outcome, evidence (+ reason when it is a string). */
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const pressBg = usePressBg();
  const label =
    accessibilityLabel ??
    [name, outcomeLabel(outcome), evidence ? evidenceLabel(evidence) : null, typeof reason === 'string' ? reason : null]
      .filter(Boolean)
      .join(', ');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.crit, pressed && { backgroundColor: pressBg }]}
    >
      <View style={styles.head}>
        <Txt style={[font(600, 15, 20), { flex: 1 }]}>{name}</Txt>
        {onPress ? <ChevronRight color={colors.inkMuted} size={20} strokeWidth={1.8} /> : null}
      </View>
      <BadgeRow>
        <StatusBadge outcome={outcome} />
        {evidence ? <EvidenceTag evidence={evidence} /> : null}
      </BadgeRow>
      {reason ? (
        <Txt tabular style={[font(400, 14, 20), { color: colors.inkMuted }]}>
          {reason}
        </Txt>
      ) : null}
    </Pressable>
  );
}

/** Applicant in a rental's list (S-06, S-18): avatar or queue number, name + status chip, received time, summary. */
export function ApplicantRow({
  name,
  status,
  received,
  summary,
  summaryReady,
  queue,
  onPress,
}: {
  name: string;
  /** Status chip ("In review", "Conditional offer"). */
  status?: string;
  /** "Received Dec 2, 9:14 AM". */
  received: string;
  /** "Ready to decide" / "2 items missing". */
  summary: string;
  /** Ready to decide (indigo ✓) vs things missing (muted ○). */
  summaryReady?: boolean;
  /** First-come place: shows #n instead of the avatar; `active` = being reviewed now. */
  queue?: { n: number; active?: boolean };
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const pressBg = usePressBg();
  const fg = summaryReady ? colors.accent : colors.inkMuted;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[queue ? t('ui:queue.position', { n: queue.n }) : null, name, status, received, summary].filter(Boolean).join(', ')}
      style={({ pressed }) => [styles.app, pressed && { backgroundColor: pressBg }]}
    >
      {queue ? <QueueNumber n={queue.n} active={queue.active} /> : <Avatar name={name} />}
      <View style={styles.main}>
        <View style={styles.nameRow}>
          <Txt style={[font(600, 16, 22), { flexShrink: 1 }]}>{name}</Txt>
          {status ? <Chip label={status} size="sm" /> : null}
        </View>
        <Txt variant="caption" color="inkMuted">
          {received}
        </Txt>
        <View style={styles.sum}>
          <Glyph name={summaryReady ? 'check' : 'ring'} size={16} color={fg} strokeWidth={2.2} />
          <Txt style={[font(summaryReady ? 600 : 500, 14, 20), { color: fg, flexShrink: 1 }]}>{summary}</Txt>
        </View>
      </View>
      {onPress ? <ChevronRight color={colors.inkMuted} size={20} strokeWidth={1.8} /> : null}
    </Pressable>
  );
}

/** Rental on the Rentals tab (S-02). */
export function RentalCard({
  address,
  city,
  status,
  facts,
  mode,
  count,
  highlight,
  onPress,
}: {
  address: string;
  city: string;
  status: { label: string; tone: ChipTone };
  /** "$1,650/mo · 2 bd". */
  facts: string;
  mode: { label: string; icon?: IconComponent };
  /** "4 applicants". */
  count: string;
  /** "1 ready to decide" (indigo, after count). */
  highlight?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={[address, city, status.label, facts, mode.label, count, highlight].filter(Boolean).join(', ')}
      style={{ gap: 12 }}
    >
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Txt style={font(600, 17, 22)}>{address}</Txt>
          <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{city}</Txt>
        </View>
        <Chip label={status.label} tone={status.tone} dot={status.tone !== 'outline'} />
      </View>
      <View style={styles.between}>
        <Txt tabular style={[font(500, 15, 20), { flexShrink: 1 }]}>
          {facts}
        </Txt>
        <Chip label={mode.label} tone="outline" icon={mode.icon} />
      </View>
      <View style={[styles.between, styles.foot, { borderTopColor: colors.line }]}>
        <Txt style={[font(400, 14, 20), { color: colors.inkMuted, flex: 1 }]}>
          {count}
          {highlight ? (
            <>
              {' · '}
              <Txt style={[font(600, 14, 20), { color: colors.accent }]}>{highlight}</Txt>
            </>
          ) : null}
        </Txt>
        {onPress ? <ChevronRight color={colors.inkMuted} size={20} strokeWidth={1.8} /> : null}
      </View>
    </Card>
  );
}

/** S-09 top card: "Ready to decide" (accent-soft) or "3 items missing". Never a score. */
export function SummaryCard({ ready, title, subtitle }: { ready: boolean; title: string; subtitle?: string }) {
  const { colors, radius } = useTheme();
  const card = useCardStyle();
  return (
    <View
      accessible
      accessibilityLabel={[title, subtitle].filter(Boolean).join('. ')}
      style={[
        styles.summary,
        { borderRadius: radius.lg },
        ready ? { backgroundColor: colors.accentSoft } : { ...card, boxShadow: undefined },
      ]}
    >
      <View style={[styles.big, { backgroundColor: ready ? colors.accent : colors.surface2 }]}>
        <Glyph name={ready ? 'check' : 'ring'} size={24} color={ready ? colors.onAccent : colors.ink} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={[font(650, 18, 24), { color: ready ? colors.accent : colors.ink }]}>{title}</Txt>
        {subtitle ? <Txt variant="caption" color="inkMuted">{subtitle}</Txt> : null}
      </View>
    </View>
  );
}

/** "3 things to check" (S-09): warn-soft card listing IssueItems. */
export function IssuesCard({ title, children }: { title: string; children: ReactNode }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.issues, { backgroundColor: colors.warnSoft, borderRadius: radius.lg }]}>
      <View style={styles.issuesH}>
        <Glyph name="alertCircle" size={20} color={colors.warn} />
        <Txt accessibilityRole="header" style={[font(650, 15, 20), { color: colors.warn, flex: 1 }]}>
          {title}
        </Txt>
      </View>
      {children}
    </View>
  );
}

/** One issue: badge (outcome or evidence), title, detail, optional action ("Call landlord"). */
export function IssueItem({
  outcome,
  evidence,
  title,
  detail,
  action,
}: {
  outcome?: Outcome;
  evidence?: Evidence;
  title: string;
  detail?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.issue}>
      <View style={{ flex: 1, minWidth: 160 }} accessible accessibilityLabel={[outcome ? outcomeLabel(outcome) : null, evidence ? evidenceLabel(evidence) : null, title, detail].filter(Boolean).join(', ')}>
        {outcome ? <StatusBadge outcome={outcome} /> : evidence ? <EvidenceTag evidence={evidence} /> : null}
        <Txt style={[font(400, 14, 20), { marginTop: 4 }]}>{title}</Txt>
        {detail ? <Txt variant="caption" color="inkMuted">{detail}</Txt> : null}
      </View>
      {action ? (
        // B-75: 48 touch / accessibility frame around the 36 button.
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} style={styles.actFrame}>
          {({ pressed }) => (
            <View style={[styles.act, { backgroundColor: colors.surface1, opacity: pressed ? 0.7 : 1 }]}>
              <Txt style={[font(600, 14, 20), { color: colors.accent }]}>{action.label}</Txt>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  crit: { paddingVertical: 14, paddingHorizontal: 16, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  app: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  main: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sum: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  foot: { paddingTop: 12, borderTopWidth: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  big: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  issues: { paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  issuesH: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  issue: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  actFrame: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  act: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
});
