import { Info, Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { t } from '@/i18n';
import { font, useTheme } from '@/theme';

import { Button, type IconComponent } from './Button';
import { Glyph } from './Glyph';
import { Txt } from './Txt';

export type BannerTone = 'warn' | 'info' | 'accent';

/**
 * Banner (mockup Components › Banner): warn (legal warnings, amber icon on warn-soft) · info (card with indigo icon,
 * "Criteria are locked…") · accent (accent-soft, mode notes). Optional bold title and link actions.
 */
export function Banner({
  tone = 'info',
  title,
  children,
  icon: Icon,
  actions,
  style,
}: {
  tone?: BannerTone;
  title?: string;
  children?: ReactNode;
  icon?: IconComponent;
  actions?: { label: string; onPress: () => void }[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  const bg = tone === 'warn' ? colors.warnSoft : tone === 'accent' ? colors.accentSoft : colors.surface1;
  const iconColor = tone === 'warn' ? colors.warn : colors.accent;
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: bg, borderRadius: radius.md },
        tone === 'info' && { borderWidth: 1, borderColor: colors.line },
        style,
      ]}
    >
      <View style={{ marginTop: 1 }}>
        {Icon ? (
          <Icon color={iconColor} size={20} strokeWidth={1.8} />
        ) : tone === 'warn' ? (
          <Glyph name="alertCircle" size={20} color={iconColor} />
        ) : (
          <Info color={iconColor} size={20} strokeWidth={1.8} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Txt style={font(400, 14, 20)} accessibilityRole={title ? 'alert' : undefined}>
          {title ? <Txt style={font(600, 14, 20)}>{`${title} `}</Txt> : null}
          {typeof children === 'string' ? children : null}
        </Txt>
        {typeof children !== 'string' ? children : null}
        {actions?.length ? (
          <View style={styles.acts}>
            {actions.map((a) => (
              <Pressable key={a.label} onPress={a.onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={a.label}>
                <Txt style={[font(600, 14, 20), { color: colors.accent }]}>{a.label}</Txt>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** "Evenlease is a checklist, not legal advice…" under decision / letter / criteria screens (product.md §5.0). */
export function LegalFooter({ text, style }: { text?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.legal, style]} accessible accessibilityRole="text">
      <View style={{ marginTop: 1 }}>
        <Glyph name="scale" size={14} color={colors.inkMuted} strokeWidth={2} />
      </View>
      <Txt style={[font(400, 12, 17), { color: colors.inkMuted, textAlign: 'center', flexShrink: 1 }]}>
        {text ?? t('common:notLegalAdvice')}
      </Txt>
    </View>
  );
}

/** Empty state (No rentals yet / No applicants yet): soft circle art, title, text, primary + ghost actions. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  primary,
  secondary,
  style,
}: {
  icon: IconComponent;
  title: string;
  body?: string;
  primary?: { label: string; onPress: () => void; icon?: IconComponent };
  secondary?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, style]}>
      <View style={[styles.art, { backgroundColor: colors.accentSoft }]} importantForAccessibility="no-hide-descendants">
        <Icon color={colors.accent} size={52} strokeWidth={1.4} />
      </View>
      <Txt accessibilityRole="header" align="center" style={font(650, 20, 26)}>
        {title}
      </Txt>
      {body ? (
        <Txt align="center" style={[font(400, 15, 22), { color: colors.inkMuted, maxWidth: 280 }]}>
          {body}
        </Txt>
      ) : null}
      {primary || secondary ? (
        <View style={styles.emptyActs}>
          {primary ? <Button block label={primary.label} icon={primary.icon ?? Plus} onPress={primary.onPress} /> : null}
          {secondary ? <Button block variant="ghost" label={secondary.label} onPress={secondary.onPress} /> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Application form progress (S-08, 7 parts): "Step 2 of 7 · Household" + 7 bars (done = accent, current = accent 45 %).
 * `current` is 0-based.
 */
export function FormProgress({
  current,
  total = 7,
  title,
  right,
}: {
  current: number;
  total?: number;
  /** Section name. */
  title?: string;
  /** Right text ("Saved"). */
  right?: string;
}) {
  const { colors } = useTheme();
  const label = t('ui:progress.step', { n: current + 1, total });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={[label, title].filter(Boolean).join(', ')}
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
      style={{ gap: 6 }}
    >
      <View style={styles.stephead}>
        <Txt style={[font(500, 13, 18), { color: colors.inkMuted, flexShrink: 1 }]}>
          {title ? `${label} · ${title}` : label}
        </Txt>
        {right ? <Txt style={[font(500, 13, 18), { color: colors.inkMuted }]}>{right}</Txt> : null}
      </View>
      <View style={styles.bars}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { backgroundColor: i <= current ? colors.accent : colors.surface2, opacity: i === current ? 0.45 : 1 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

/** Onboarding page dots (current = 24 wide accent pill). */
export function PageDots({ count, current }: { count: number; current: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={t('ui:progress.page', { n: current + 1, total: count })}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={{
            width: i === current ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: i === current ? colors.accent : colors.lineStrong,
            opacity: i === current ? 1 : 0.5,
          }}
        />
      ))}
    </View>
  );
}

/** Document photo thumbnail placeholder (64×80) with ✓ when checked; `add` = dashed "Add" tile. */
export function DocThumb({
  checked,
  add,
  label,
  onPress,
  children,
}: {
  checked?: boolean;
  add?: boolean;
  /** Spoken label ("Photo ID, page 1" / "Add photo"). */
  label: string;
  onPress?: () => void;
  /** An expo-image <Image> filling the tile. */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={label}
      style={[
        styles.thumb,
        add
          ? { borderWidth: 1.5, borderColor: colors.lineStrong, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 }
          : { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
      ]}
    >
      {add ? (
        <>
          <Plus color={colors.accent} size={20} strokeWidth={2} />
          <Txt style={[font(600, 12, 16), { color: colors.accent }]}>{t('ui:thumb.add')}</Txt>
        </>
      ) : (
        (children ?? (
          <View style={{ paddingHorizontal: 10, paddingTop: 12, gap: 6 }}>
            {[0.5, 1, 1, 1, 1].map((o, i) => (
              <View key={i} style={{ height: 4, borderRadius: 2, backgroundColor: i ? colors.line : colors.lineStrong, opacity: o }} />
            ))}
          </View>
        ))
      )}
      {checked && !add ? (
        <View style={[styles.ok, { backgroundColor: colors.accent }]}>
          <Glyph name="check" size={14} color={colors.onAccent} strokeWidth={2.6} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  acts: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  legal: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 6, paddingVertical: 4, paddingHorizontal: 12 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 24, paddingBottom: 24 },
  art: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyActs: { alignSelf: 'stretch', gap: 8, marginTop: 12 },
  stephead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  thumb: { width: 64, height: 80, borderRadius: 8, overflow: 'hidden' },
  ok: { position: 'absolute', right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
