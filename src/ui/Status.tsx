import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Evidence, Outcome } from '@/engine';
import { t } from '@/i18n';
import { fonts, radius, useTheme, type Palette } from '@/theme';

import { Check, EqualNot, Lock, MessageCircle, ShieldCheck, TriangleAlert, X, type LucideIcon } from './icons';
import { Txt } from './Txt';

/** The engine's Criterion result outcome / evidence ('not_reviewed' = C10 before an offer, drawn "After offer"). */
export type { Evidence, Outcome };

export function outcomeLabel(o: Outcome): string {
  return t(`ui:status.${OUTCOME_KEY[o]}`);
}
export function evidenceLabel(e: Evidence): string {
  return t(`ui:status.${e}`);
}
const OUTCOME_KEY = { met: 'met', not_met: 'notMet', missing: 'missing', needs_review: 'needsReview', not_reviewed: 'afterOffer' } as const;

/** Missing icon: the mockup's dashed circle (lucide CircleDashed has gaps of another rhythm). */
function DashedCircle({ size = 16, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2.2} strokeDasharray="3 3" />
    </Svg>
  );
}

function outcomeLook(o: Outcome, c: Palette): { fg: string; bg: string; outline?: string; Icon: LucideIcon | null } {
  switch (o) {
    case 'met':
      return { fg: c.accent, bg: c.accentSoft, Icon: Check };
    case 'not_met':
      return { fg: c.danger, bg: c.dangerSoft, Icon: X };
    case 'missing':
      return { fg: c.missing, bg: 'transparent', outline: c.missing, Icon: null };
    case 'needs_review':
      return { fg: c.warning, bg: c.warningSoft, Icon: TriangleAlert };
    case 'not_reviewed':
      return { fg: c.text2, bg: c.surface2, Icon: Lock };
  }
}

/** Outcome badge (ev.css `.b`): icon + word, never colour alone. Radius 6, 24 high. */
export function OutcomeBadge({ outcome, label, style }: { outcome: Outcome; label?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const l = outcomeLook(outcome, colors);
  const text = label ?? outcomeLabel(outcome);
  return (
    <View
      accessible
      accessibilityLabel={text}
      style={[styles.badge, { backgroundColor: l.bg, borderWidth: l.outline ? 1.5 : 0, borderColor: l.outline }, style]}>
      {l.Icon ? <l.Icon size={16} color={l.fg} strokeWidth={2.4} /> : <DashedCircle color={l.fg} />}
      <Txt style={[styles.badgeText, { color: l.fg }]}>{text}</Txt>
    </View>
  );
}

const EVIDENCE: Record<Evidence, { Icon: LucideIcon; color: keyof Palette }> = {
  verified: { Icon: ShieldCheck, color: 'accent' },
  claimed: { Icon: MessageCircle, color: 'text2' },
  mismatch: { Icon: EqualNot, color: 'warning' },
};

/** Evidence tag (ev.css `.e`): Verified (shield) · Claimed (bubble) · Mismatch (≠). */
export function EvidenceTag({ evidence, style }: { evidence: Evidence; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const e = EVIDENCE[evidence];
  const fg = colors[e.color];
  const text = evidenceLabel(evidence);
  return (
    <View accessible accessibilityLabel={text} style={[styles.ev, style]}>
      <e.Icon size={16} color={fg} strokeWidth={2.2} />
      <Txt style={[styles.evText, { color: fg }]}>{text}</Txt>
    </View>
  );
}

export type ChipTone = 'neutral' | 'accent' | 'warning' | 'danger';

/** Status / mode chip (ev.css `.chip`): rental status "Open" / "Offer out", review mode, "Sample", "2 pages". */
export function Chip({ label, tone = 'neutral', icon: Icon, style }: { label: string; tone?: ChipTone; icon?: LucideIcon; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const [bg, fg] =
    tone === 'accent'
      ? [colors.accentSoft, colors.accent]
      : tone === 'warning'
        ? [colors.warningSoft, colors.warning]
        : tone === 'danger'
          ? [colors.dangerSoft, colors.danger]
          : [colors.surface2, colors.text2];
  return (
    <View accessible accessibilityLabel={label} style={[styles.chip, { backgroundColor: bg }, style]}>
      {Icon ? <Icon size={16} color={fg} strokeWidth={2.1} /> : null}
      <Txt style={[styles.chipText, { color: fg }]}>{label}</Txt>
    </View>
  );
}

/**
 * One criterion row (S-09 list, S-15 reasons, evidence sheets): name + one-line reason, outcome badge + evidence on
 * the right. Read as one item: "Income, met, verified: $5,351.67/mo is 3.24× rent".
 */
export function CriterionRow({
  name,
  reason,
  outcome,
  evidence,
  last,
}: {
  name: string;
  reason?: string;
  outcome: Outcome;
  evidence?: Evidence | null;
  /** No divider under the last row. */
  last?: boolean;
}) {
  const { colors } = useTheme();
  const a11y = [name, outcomeLabel(outcome), evidence ? evidenceLabel(evidence) : null].filter(Boolean).join(', ') + (reason ? `: ${reason}` : '');
  return (
    <View accessible accessibilityLabel={a11y} style={[styles.crit, !last && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.border }]}>
      <View style={styles.critText}>
        <Txt v="secondary" c="text" weight="semibold">
          {name}
        </Txt>
        {reason ? (
          <Txt v="small" c="text2" num>
            {reason}
          </Txt>
        ) : null}
      </View>
      <View style={styles.critBadges}>
        <OutcomeBadge outcome={outcome} />
        {evidence ? <EvidenceTag evidence={evidence} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 24, paddingHorizontal: 8, borderRadius: radius.badge, alignSelf: 'flex-start' },
  badgeText: { fontSize: 13, lineHeight: 17, fontFamily: fonts.strong },
  ev: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  evText: { fontSize: 12, lineHeight: 16, fontFamily: fonts.semibold },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 26, paddingHorizontal: 10, borderRadius: radius.chip, alignSelf: 'flex-start' },
  chipText: { fontSize: 13, lineHeight: 17, fontFamily: fonts.semibold },
  crit: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 13 },
  critText: { flex: 1, gap: 3 },
  critBadges: { alignItems: 'flex-end', gap: 4, flexShrink: 0, maxWidth: '50%' },
});
