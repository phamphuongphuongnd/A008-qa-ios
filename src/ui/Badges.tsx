import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Evidence, Outcome } from '@/engine';
import { t } from '@/i18n';
import { font, useTheme } from '@/theme';

import type { IconComponent } from './Button';
import { Glyph, type GlyphName } from './Glyph';
import { Txt } from './Txt';

const OUTCOME: Record<Outcome, { glyph: GlyphName; label: () => string }> = {
  met: { glyph: 'check', label: () => t('ui:status.met') },
  not_met: { glyph: 'x', label: () => t('ui:status.notMet') },
  missing: { glyph: 'ring', label: () => t('ui:status.missing') },
  needs_review: { glyph: 'bang', label: () => t('ui:status.needsReview') },
  not_reviewed: { glyph: 'clock', label: () => t('ui:status.notReviewed') },
};

const EVIDENCE: Record<Evidence, { glyph: GlyphName; label: () => string }> = {
  verified: { glyph: 'shieldCheck', label: () => t('ui:status.verified') },
  claimed: { glyph: 'bubble', label: () => t('ui:status.claimed') },
  mismatch: { glyph: 'notEqual', label: () => t('ui:status.mismatch') },
};

export const outcomeLabel = (o: Outcome) => OUTCOME[o].label();
export const evidenceLabel = (e: Evidence) => EVIDENCE[e].label();

/**
 * Criterion result badge (product.md §5.0): always icon + word, never colour alone.
 * Met ✓ (indigo) · Not met ✕ (crimson) · Missing ○ · Needs review ! (amber) · Not reviewed yet (clock, outline).
 */
export function StatusBadge({ outcome, large }: { outcome: Outcome; large?: boolean }) {
  const { colors } = useTheme();
  const s = {
    met: { bg: colors.accentSoft, fg: colors.accent, border: undefined },
    not_met: { bg: colors.dangerSoft, fg: colors.danger, border: undefined },
    missing: { bg: colors.surface2, fg: colors.inkMuted, border: colors.line },
    needs_review: { bg: colors.warnSoft, fg: colors.warn, border: undefined },
    not_reviewed: { bg: 'transparent', fg: colors.inkMuted, border: colors.lineStrong },
  }[outcome];
  const label = OUTCOME[outcome].label();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.badge,
        large && styles.badgeLarge,
        { backgroundColor: s.bg, borderColor: s.border ?? 'transparent', borderWidth: s.border ? 1 : 0 },
      ]}
    >
      <Glyph name={OUTCOME[outcome].glyph} size={large ? 22 : 14} color={s.fg} strokeWidth={2.4} />
      <Txt variant="badge" style={[{ color: s.fg }, large && font(600, 22, 28)]}>
        {label}
      </Txt>
    </View>
  );
}

/** Evidence tag next to a badge: Verified (shield ✓, indigo) · Claimed (speech bubble, muted) · Mismatch (≠, amber). */
export function EvidenceTag({ evidence, compact }: { evidence: Evidence; compact?: boolean }) {
  const { colors } = useTheme();
  const fg = evidence === 'verified' ? colors.accent : evidence === 'mismatch' ? colors.warn : colors.inkMuted;
  const label = EVIDENCE[evidence].label();
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={compact ? styles.evCompact : styles.ev}>
      <Glyph name={EVIDENCE[evidence].glyph} size={compact ? 12 : 14} color={fg} strokeWidth={2.4} />
      <Txt
        style={[
          compact ? font(500, 11, 14) : font(evidence === 'mismatch' ? 600 : 500, 12, 16, 0.01),
          { color: fg },
        ]}
      >
        {label}
      </Txt>
    </View>
  );
}

export type ChipTone = 'neutral' | 'accent' | 'warn' | 'outline' | 'solid';

/**
 * Chip: rental status (Open / Offer out / Leased / Closed, with `dot`), review mode (outline + icon), applicant status.
 * `size="sm"` is the 22 high chip inside applicant rows.
 */
export function Chip({
  label,
  tone = 'neutral',
  dot,
  icon: Icon,
  size = 'md',
  style,
}: {
  label: string;
  tone?: ChipTone;
  dot?: boolean;
  icon?: IconComponent;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const s = {
    neutral: { bg: colors.surface2, fg: colors.ink, border: undefined },
    accent: { bg: colors.accentSoft, fg: colors.accent, border: undefined },
    warn: { bg: colors.warnSoft, fg: colors.warn, border: undefined },
    outline: { bg: 'transparent', fg: colors.inkMuted, border: colors.lineStrong },
    solid: { bg: colors.accent, fg: colors.onAccent, border: undefined },
  }[tone];
  const sm = size === 'sm';
  return (
    <View
      style={[
        styles.chip,
        sm && styles.chipSm,
        { backgroundColor: s.bg, borderWidth: s.border ? 1 : 0, borderColor: s.border },
        style,
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: s.fg }]} /> : null}
      {Icon ? <Icon color={s.fg} size={14} strokeWidth={2.2} /> : null}
      <Txt style={[sm ? font(500, 12, 16) : font(500, 13, 18), { color: s.fg }]}>{label}</Txt>
    </View>
  );
}

/** Countdown pill (First-come 72 h / 48 h, offers): amber while urgent, `calm` neutral. Label is the full sentence. */
export function TimerChip({ label, calm }: { label: string; calm?: boolean }) {
  const { colors } = useTheme();
  const fg = calm ? colors.ink : colors.warn;
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={label}
      style={[styles.timer, { backgroundColor: calm ? colors.surface2 : colors.warnSoft }]}
    >
      <Glyph name="timer" size={16} color={fg} />
      <Txt tabular style={[font(600, 13, 18), { color: fg }]}>
        {label}
      </Txt>
    </View>
  );
}

/** "#2" place in the First-come queue; `active` = the one being reviewed now. */
export function QueueNumber({ n, active }: { n: number; active?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={t('ui:queue.position', { n })}
      style={[styles.qnum, { backgroundColor: active ? colors.accent : colors.surface2 }]}
    >
      <Txt tabular style={[font(650, 14, 18), { color: active ? colors.onAccent : colors.ink }]}>{`#${n}`}</Txt>
    </View>
  );
}

/** Initials circle (40). Decorative: the row reads the name. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}
    >
      <Txt style={font(600, 15, 20)}>{initials}</Txt>
    </View>
  );
}

/** Wrapping row of badges / chips (gap 6–8). */
export function BadgeRow({ children, gap = 6 }: { children: ReactNode; gap?: number }) {
  return <View style={[styles.row, { gap }]}>{children}</View>;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    minHeight: 24,
    paddingLeft: 6,
    paddingRight: 9,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeLarge: { minHeight: 40, paddingLeft: 10, paddingRight: 14, gap: 6 },
  ev: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 22, paddingHorizontal: 2, alignSelf: 'flex-start' },
  evCompact: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 26,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipSm: { minHeight: 22, paddingHorizontal: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 28,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 2,
    borderRadius: 999,
  },
  qnum: { minWidth: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
