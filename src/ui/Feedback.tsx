import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { t } from '@/i18n';
import { layout, useTheme, type Palette } from '@/theme';

import { Info, TriangleAlert, type LucideIcon } from './icons';
import { Txt } from './Txt';

export type BannerTone = 'warning' | 'accent' | 'danger' | 'neutral';

function bannerColors(tone: BannerTone, c: Palette) {
  switch (tone) {
    case 'warning':
      return { bg: c.warningSoft, icon: c.warning };
    case 'accent':
      return { bg: c.accentSoft, icon: c.accent };
    case 'danger':
      return { bg: c.dangerSoft, icon: c.danger };
    case 'neutral':
      return { bg: c.surface2, icon: c.text2 };
  }
}

/**
 * ev.css `.ban`: icon + title / text (+ an action at the right, e.g. a small "Back up" button). Orange never blocks;
 * red only for errors and delete. Announced politely when it appears.
 */
export function Banner({
  tone = 'warning',
  title,
  body,
  icon,
  action,
  style,
}: {
  tone?: BannerTone;
  title?: string;
  body?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const c = bannerColors(tone, colors);
  const Icon = icon ?? (tone === 'neutral' || tone === 'accent' ? Info : TriangleAlert);
  return (
    <View style={[styles.banner, { backgroundColor: c.bg }, style]} accessibilityLiveRegion="polite">
      <View accessible style={styles.bannerText} accessibilityLabel={[title, body].filter(Boolean).join('. ')}>
        <View style={styles.bannerIcon}>
          <Icon size={20} color={c.icon} strokeWidth={2.2} />
        </View>
        <View style={styles.grow}>
          {title ? (
            <Txt v="secondary" c="text" weight="semibold">
              {title}
            </Txt>
          ) : null}
          {body ? (
            <Txt v="small" c={title ? 'text2' : tone === 'neutral' ? 'text2' : 'text'}>
              {body}
            </Txt>
          ) : null}
        </View>
      </View>
      {action ? <View style={styles.bannerAction}>{action}</View> : null}
    </View>
  );
}

/** "Evenlease is a checklist, not legal advice. Laws vary by state and city." (product.md §5.0; ev.css `.legal`). */
export function LegalNote({ short, style }: { short?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <Txt v="hint" style={styles.legal}>
        {short ? t('ui:legal.short') : t('common:notLegalAdvice')}
      </Txt>
    </View>
  );
}

/** S-02 / S-06 / S-10 empty state: 88 icon tile, heading, one sentence, then the actions (children). */
export function EmptyState({ icon: Icon, title, body, children }: { icon: LucideIcon; title: string; body?: string; children?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyTile, { backgroundColor: colors.accentSoft }]} accessible={false} importantForAccessibility="no-hide-descendants">
        <Icon size={40} color={colors.accent} strokeWidth={1.8} />
      </View>
      <Txt v="heading" accessibilityRole="header" style={styles.center}>
        {title}
      </Txt>
      {body ? (
        <Txt v="body" c="text2" style={styles.center}>
          {body}
        </Txt>
      ) : null}
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
  );
}

/** ev.css `.prog`: 4 high, accent fill. `value` 0–1. */
export function ProgressBar({ value, label, style }: { value: number; label: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={[styles.prog, { backgroundColor: colors.surface2 }, style]}>
      <View style={[styles.progFill, { width: `${pct * 100}%`, backgroundColor: colors.accent }]} />
    </View>
  );
}

/**
 * Progress of the 7-part Application (S-08): bar + "Step 6 of 7" for screen readers. Put it under a ScreenHeader
 * whose caption is "Marcus Webb · 6 of 7".
 */
export function FormProgress({ step, total }: { step: number; total: number }) {
  return <ProgressBar value={step / total} label={t('ui:form.stepOf', { step, total })} style={styles.formProg} />;
}

/** Small "x of y" stepper dots (onboarding pages). */
export function PageDots({ index, count }: { index: number; count: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dots} accessible accessibilityLabel={t('ui:form.pageOf', { page: index + 1, count })}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, { width: i === index ? 20 : 8, backgroundColor: i === index ? colors.accent : colors.border }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0, gap: 2 },
  banner: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  bannerText: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexGrow: 1, flexShrink: 1, flexBasis: 200 },
  bannerIcon: { paddingTop: 0 },
  bannerAction: { marginLeft: 'auto' },
  legal: { textAlign: 'center' },
  center: { textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 32 },
  emptyTile: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyActions: { alignItems: 'center', gap: 4, marginTop: 8 },
  prog: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 2 },
  formProg: { marginHorizontal: layout.gutter, marginTop: 6, marginBottom: 10 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, borderRadius: 4 },
});
