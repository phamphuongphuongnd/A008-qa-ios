import type { ComponentRef, ReactNode, Ref } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { router } from '@/services/router';
import { fonts, layout, radius, size, useTheme, type ColorName } from '@/theme';

import { IconButton } from './Button';
import { initials } from './format';
import { ArrowLeft, ChevronRight, FileText, type LucideIcon } from './icons';
import { useKeyboardUp } from './useKeyboardUp';
import { Txt } from './Txt';

// ---------------- Screen ----------------

export interface ScreenProps {
  /** ScreenHeader (or anything) above the body, outside the scroll. */
  header?: ReactNode;
  /** Sticky bar under the body (FooterBar). */
  footer?: ReactNode;
  /** Tab bar underneath (tab screens): no bottom inset here, the tab bar has it. */
  inTabs?: boolean;
  /** false = the body is laid out by the caller (lists with FlashList). */
  scroll?: boolean;
  /** Body gap between children (ev.css `.body` 12). */
  gap?: number;
  scrollRef?: Ref<ComponentRef<typeof ScrollView>>;
  contentStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * A screen: theme background, top inset, header, scrolling body (20 side padding, gap 12, max 600 wide centered on
 * tablets) and an optional sticky footer above the system navigation bar.
 */
export function Screen({ header, footer, inTabs, scroll = true, gap = 12, scrollRef, contentStyle, children }: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const body = [styles.body, { gap, paddingBottom: footer || inTabs ? 20 : 20 + insets.bottom }, contentStyle];
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.column}>{header}</View>
      {scroll ? (
        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={[styles.column, ...body]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.column, ...body]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

/**
 * ev.css `.top`: large title (tab roots, "Rentals") or back + heading + subtitle (pushed screens). `caption` goes above
 * the title ("Marcus Webb · 6 of 7"). `actions` sit at the right (IconButton ⋯ / +).
 */
export function ScreenHeader({
  title,
  subtitle,
  caption,
  large,
  onBack,
  backLabel,
  actions,
}: {
  title: string;
  subtitle?: string;
  caption?: string;
  /** 28/700 title of a tab root. Default: 21/650 heading with a back button. */
  large?: boolean;
  /** Back button; default router.back(). Pass `false` for none. */
  onBack?: (() => void) | false;
  backLabel?: string;
  actions?: ReactNode;
}) {
  const showBack = !large && onBack !== false;
  return (
    <View style={[styles.top, showBack ? styles.topBack : null, large ? styles.topLarge : null]}>
      {showBack ? (
        <IconButton icon={ArrowLeft} label={backLabel ?? t('common:actions.back')} onPress={onBack || (() => router.back())} />
      ) : null}
      <View style={styles.flexText}>
        {caption ? (
          <Txt v="caption" num>
            {caption}
          </Txt>
        ) : null}
        <Txt v={large ? 'title' : 'heading'} accessibilityRole="header">
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="secondary" num>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Sticky bottom bar with the screen's main button(s) (S-09 "Make a decision", form Back / Next). */
export function FooterBar({ children, row, note }: { children: ReactNode; row?: boolean; note?: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();
  return (
    <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.bg, paddingBottom: (keyboardUp ? 0 : insets.bottom) + 12 }]}>
      <View style={[styles.column, row ? styles.footerRow : styles.footerCol]}>{children}</View>
      {note ? <View style={styles.column}>{note}</View> : null}
    </View>
  );
}

// ---------------- Card / rows ----------------

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  /** Screen-reader label of a tappable card (its parts are read as one). */
  accessibilityLabel?: string;
  /** Background / border override: 'warningSoft' for the S-09 Issues card. */
  tone?: 'default' | 'warning' | 'accent' | 'danger' | 'muted';
  /** List cards (`padding: 4px 16px; gap: 0`). */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** ev.css `.card`: surface, 1px border, radius 14, padding 16, gap 10. Tappable when `onPress`. */
export function Card({ children, onPress, accessibilityLabel, tone = 'default', flush, style }: CardProps) {
  const { colors } = useTheme();
  const bg: Record<NonNullable<CardProps['tone']>, string> = {
    default: colors.surface,
    warning: colors.warningSoft,
    accent: colors.accentSoft,
    danger: colors.dangerSoft,
    muted: colors.surface2,
  };
  const box = [
    styles.card,
    flush && styles.cardFlush,
    { backgroundColor: bg[tone], borderColor: tone === 'default' ? colors.border : 'transparent' },
    style,
  ];
  if (!onPress) return <View style={box}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: colors.pressTint, foreground: true }}
      style={({ pressed }) => [...box, { overflow: 'hidden' }, pressed && { opacity: 0.92 }]}>
      {children}
    </Pressable>
  );
}

/**
 * ev.css `.li`: one row of a list card — leading icon / avatar, title + subtitle, trailing content and/or chevron.
 * Hairline under each row except `last`. Tappable when `onPress` (min 48 high).
 */
export function ListRow({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  leading,
  trailing,
  chevron,
  onPress,
  last,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: ColorName;
  /** Avatar / checkbox / thumbnail instead of an icon. */
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  last?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  const content = (
    <>
      {leading ?? (Icon ? <Icon size={20} color={colors[iconColor ?? 'accent']} strokeWidth={2} /> : null)}
      <View style={styles.flexText}>
        <Txt weight="semibold" style={{ fontSize: 15 }}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="small" c="text2" num>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing}
      {chevron ? <ChevronRight size={20} color={colors.text2} strokeWidth={2.2} /> : null}
    </>
  );
  const rowStyle = [styles.li, !last && { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: colors.border }];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      android_ripple={{ color: colors.pressTint }}
      style={rowStyle}>
      {content}
    </Pressable>
  );
}

/** ev.css `.hr`. */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

/** ev.css `.kv`: grey label left, value right (tabular). Stacks on two lines when given `stack` (320 dp + big text). */
export function KeyValue({ label, value, stack }: { label: string; value: string; stack?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} style={stack ? styles.kvStack : styles.kv}>
      <Txt v="secondary" style={stack ? undefined : styles.flexText}>
        {label}
      </Txt>
      <Txt v="secondary" c="text" num weight="semibold" style={stack ? undefined : styles.kvValue}>
        {value}
      </Txt>
    </View>
  );
}

/** ev.css `.cap`: small caps section label ("ISSUES · 4", "LANDLORD ONLY"). */
export function SectionLabel({ children, color }: { children: string; color?: ColorName }) {
  return (
    <Txt v="caption" c={color} accessibilityRole="header">
      {children}
    </Txt>
  );
}

/** ev.css `.av`: initials on accent-soft, 40 (or `size`). Decorative (the name is next to it). */
export function Avatar({ name, size: s = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.av, { width: s, height: s, borderRadius: s / 2, backgroundColor: colors.accentSoft }]}>
      <Txt style={{ color: colors.accent, fontFamily: fonts.bold, fontSize: Math.round(s * 0.38) }} maxFontSizeMultiplier={1}>
        {initials(name)}
      </Txt>
    </View>
  );
}

/** ev.css `.thumb` 64×80: document thumbnail placeholder (an expo-image goes inside `children` when there is one). */
export function Thumb({ children, label, onPress }: { children?: ReactNode; label: string; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'imagebutton' : 'image'}
      accessibilityLabel={label}
      style={[styles.thumb, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
      {children ?? <FileText size={24} color={colors.text2} strokeWidth={2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  body: { paddingHorizontal: layout.gutter, paddingTop: 4 },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingBottom: 8, paddingLeft: layout.gutter, paddingRight: 12, minHeight: 62 },
  topBack: { paddingLeft: 6 },
  topLarge: { minHeight: 62 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: layout.gutter, gap: 8 },
  footerRow: { flexDirection: 'row', gap: 10 },
  footerCol: { gap: 8 },
  card: { borderWidth: 1, borderRadius: radius.card, padding: 16, gap: 10 },
  cardFlush: { paddingVertical: 4, paddingHorizontal: 16, gap: 0 },
  li: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, minHeight: size.touch },
  kv: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  kvStack: { gap: 2 },
  kvValue: { textAlign: 'right', flexShrink: 1 },
  av: { alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 64, height: 80, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
