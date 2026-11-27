import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { font, useTheme, withAlpha } from '@/theme';

import type { IconComponent } from './Button';
import { keyValueStacked } from './textLayout';
import { TOUCH_MIN } from './touch';
import { Txt } from './Txt';

/** Surface for cards and list groups: surface-1, radius 16, 1 px line, card shadow in light. */
export function useCardStyle(): ViewStyle {
  const { colors, shadows, radius } = useTheme();
  return {
    backgroundColor: colors.surface1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    boxShadow: shadows.card,
  };
}

/**
 * Card: `default` (padding 16, gap 10) · `flush` (no padding, for lists inside) · `tint` (accent-soft, no edge).
 * With `onPress` the whole card is one button (give it an accessibilityLabel that reads the card).
 */
export function Card({
  children,
  variant = 'default',
  onPress,
  accessibilityLabel,
  style,
  testID,
}: {
  children: ReactNode;
  variant?: 'default' | 'flush' | 'tint';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const base = useCardStyle();
  const v: ViewStyle =
    variant === 'tint'
      ? { backgroundColor: t.colors.accentSoft, borderRadius: t.radius.lg }
      : variant === 'flush'
        ? { ...base, padding: 0, gap: 0, overflow: 'hidden' }
        : base;
  const pad = variant === 'flush' ? null : styles.pad;
  if (!onPress) {
    return (
      <View style={[v, pad, style]} testID={testID}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [v, pad, pressed && { backgroundColor: withAlpha(t.colors.ink, t.dark ? 0.12 : 0.04) }, style]}
    >
      {children}
    </Pressable>
  );
}

/** 1 px divider. `inset` = 16 from the left (between rows). */
export function Divider({ inset, style }: { inset?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.line, marginLeft: inset ? 16 : 0 }, style]} />;
}

/** Rows in one card with inset dividers between them (settings lists, criterion lists, applicant lists). */
export function ListGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const base = useCardStyle();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[base, { overflow: 'hidden' }, style]}>
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <Divider inset /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Value on the right ("Dark", "60 days"). */
  value?: string;
  icon?: IconComponent;
  iconTone?: 'neutral' | 'accent';
  /** Show › (rows that open a screen). Default: true when onPress is set and no `right`. */
  chevron?: boolean;
  /** Custom right side (Switch, Badge, TextButton). */
  right?: ReactNode;
  onPress?: () => void;
  /** Red title (Delete all data). */
  danger?: boolean;
  bold?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

/** List row (min 56): optional 36 icon tile, title + subtitle, value / accessory / chevron. */
export function ListRow({
  title,
  subtitle,
  value,
  icon: Icon,
  iconTone = 'neutral',
  chevron,
  right,
  onPress,
  danger,
  bold,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const t = useTheme();
  const c = t.colors;
  const showChevron = chevron ?? (!!onPress && !right);
  const body = (
    <>
      {Icon ? (
        <View style={[styles.ico, { backgroundColor: iconTone === 'accent' ? c.accentSoft : c.surface2 }]}>
          <Icon color={iconTone === 'accent' ? c.accent : danger ? c.danger : c.ink} size={20} strokeWidth={1.8} />
        </View>
      ) : null}
      <View style={styles.main}>
        <Txt style={[font(bold ? 600 : 500, 16, 22), { color: danger ? c.danger : disabled ? c.inkMuted : c.ink }]}>{title}</Txt>
        {subtitle ? <Txt variant="caption" color="inkMuted">{subtitle}</Txt> : null}
      </View>
      {value ? (
        <Txt tabular style={[font(400, 15, 20), styles.value, { color: c.inkMuted }]}>
          {value}
        </Txt>
      ) : null}
      {right}
      {showChevron ? <ChevronRight color={c.inkMuted} size={20} strokeWidth={1.8} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.row} testID={testID} accessible={!right} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle, value].filter(Boolean).join(', ')}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: withAlpha(c.ink, t.dark ? 0.12 : 0.05) }]}
    >
      {body}
    </Pressable>
  );
}

/**
 * Uppercase muted heading above a group; on the right an optional note ("Sorted by received", muted) or link
 * ("See all", accent, 48 touch frame). B-41: it owns the 8 below it — no negative margin, so the group under it can
 * never cover the label (it did inside the plain `<View>` wrappers of S-06 / S-09).
 */
export function SectionHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      {/* B-161: the title never shrinks below its own text (it wrapped "AP/PLI/CA/NT/S" at 320 dp + 200 %): the row wraps and
          the note drops under it instead. */}
      <Txt accessibilityRole="header" style={[font(600, 13, 18, 0.02), { color: colors.inkMuted, textTransform: 'uppercase', flexGrow: 1, flexShrink: 0, maxWidth: '100%' }]}>
        {title}
      </Txt>
      {meta && !action ? <Txt style={[font(500, 13, 18), { color: colors.inkMuted, flexShrink: 1, textAlign: 'right' }]}>{meta}</Txt> : null}
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} style={styles.sectionAction}>
          <Txt style={[font(600, 13, 18), { color: colors.accent }]}>{action.label}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Label … value line (summaries, report details). Value is tabular. The value keeps its own width (≤ 60 %) and the
 * label wraps; from 150 % text the value goes under the label — a short value never breaks mid-word (B-74a "N/o").
 */
export function KeyValue({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = keyValueStacked(fontScale);
  return (
    <View style={stacked ? styles.kvStacked : styles.kv} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt style={[font(400, 14, 20), { color: colors.inkMuted }, !stacked && styles.kvLabel]}>{label}</Txt>
      <Txt tabular style={[font(500, 14, 20), !stacked && styles.kvValue]}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, minHeight: 56 },
  ico: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, minWidth: 0, gap: 2 },
  value: { textAlign: 'right', flexShrink: 1, maxWidth: '45%' },
  section: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8, rowGap: 2, marginHorizontal: 4, marginTop: 4, paddingBottom: 8 },
  sectionAction: { minHeight: TOUCH_MIN, justifyContent: 'center' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  kvLabel: { flex: 1, flexShrink: 1 },
  kvValue: { textAlign: 'right', flexShrink: 0, maxWidth: '60%' },
  kvStacked: { gap: 2, paddingVertical: 4 },
});
