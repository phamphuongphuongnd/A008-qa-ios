import { ChevronLeft } from 'lucide-react-native';
import { Children, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { router } from '@/services/router';
import { font, useTheme } from '@/theme';

import { ButtonFillContext, IconButton } from './Button';
import { Glyph } from './Glyph';
import { TOUCH_MIN, appBarSideWidth } from './touch';
import { Txt } from './Txt';

/** Content column: full width on phones, max 600 centred on tablets (design size.content-max). */
export function Content({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { size } = useTheme();
  return <View style={[{ width: '100%', maxWidth: size.contentMax, alignSelf: 'center' }, style]}>{children}</View>;
}

/**
 * Screen frame: surface-0 background, top safe area, optional app bar (`header`), scrolling body (padding 4/16/24,
 * gap 16, max width 600) and a sticky `footer` (ButtonBar). The keyboard pushes the footer up (Android too).
 * `bottomInset={false}` on tab screens (the tab bar already clears the system navigation bar).
 */
export function Screen({
  children,
  header,
  footer,
  scroll = true,
  bottomInset = true,
  topInset = true,
  contentStyle,
  scrollProps,
  background,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  bottomInset?: boolean;
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, 'contentContainerStyle' | 'children'>;
  /** Default surface-0. */
  background?: string;
}) {
  const { colors, size } = useTheme();
  const insets = useSafeAreaInsets();
  const padBottom = !footer && bottomInset ? insets.bottom : 0;
  const body = [styles.body, { maxWidth: size.contentMax, paddingBottom: 24 + padBottom }, contentStyle];
  return (
    <View style={[styles.root, { backgroundColor: background ?? colors.surface0, paddingTop: topInset ? insets.top : 0 }]}>
      {header}
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" {...scrollProps} contentContainerStyle={body}>
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.root, body]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * App bar (52+): back (‹, default router.back), centred title 17/22 with optional subtitle, right actions.
 * `align="left"` for long titles next to actions.
 */
export function AppBar({
  title,
  subtitle,
  onBack,
  back = true,
  right,
  align = 'center',
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  /** false = no back button (root of a flow). */
  back?: boolean;
  right?: ReactNode;
  align?: 'center' | 'left';
}) {
  // B-74: both sides as wide as the wider one really is (back button 48, right actions measured) so a centred title
  // stays centred without the old fixed 88 + 88 that left a 320 dp phone ~96 dp for "Move-in checklist".
  const [rightW, setRightW] = useState(0);
  const sideW = appBarSideWidth(back, right ? rightW : 0);
  const centred = align === 'center';
  return (
    <View style={styles.appbar}>
      <View style={[styles.side, centred ? { width: sideW } : styles.sideLeft]}>
        {back ? (
          <IconButton icon={ChevronLeft} accessibilityLabel={t('common:actions.back')} onPress={onBack ?? (() => router.back())} />
        ) : null}
      </View>
      <View style={styles.titleBox}>
        {title ? (
          <Txt accessibilityRole="header" numberOfLines={2} style={[font(600, 17, 22), { textAlign: align }]}>
            {title}
          </Txt>
        ) : null}
        {subtitle ? (
          // 2 lines: on a narrow phone the end of "Jordan Ellis · Jan 1, 2027" (the date) must not be cut off.
          <Txt numberOfLines={2} variant="caption" color="inkMuted" style={[font(400, 12, 16), { textAlign: align }]}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      <View style={[styles.side, styles.sideRight, centred ? { width: sideW } : styles.sideLeft]}>
        {right ? (
          <View style={styles.rightContent} onLayout={(e) => setRightW(Math.ceil(e.nativeEvent.layout.width))}>
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Large screen title of the tab roots (Rentals, Guide, Settings): 30/36 bold, optional action on the right. */
export function LargeTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.large}>
      <Txt accessibilityRole="header" style={[font(700, 30, 36, -0.02), { flex: 1 }]}>
        {title}
      </Txt>
      {right}
    </View>
  );
}

/** Screen header of a Rental / Applicant: title-1 + meta line + chips row. */
export function Hero({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  const { type } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Txt accessibilityRole="header" style={type.title1}>
        {title}
      </Txt>
      {meta ? <Txt style={[font(400, 14, 20)]} color="inkMuted">{meta}</Txt> : null}
      {children ? <View style={styles.heroRow}>{children}</View> : null}
    </View>
  );
}

/**
 * Sticky bottom bar for the main action(s): surface-0, top hairline, padding 12/16 + bottom safe area.
 * `row` puts two buttons side by side (they wrap under each other at large text). `hint` under the buttons.
 */
export function ButtonBar({ children, hint, row }: { children: ReactNode; hint?: string; row?: boolean }) {
  const { colors, size } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.btnbar, { backgroundColor: colors.surface0, borderTopColor: colors.line, paddingBottom: 8 + insets.bottom }]}>
      <View style={{ width: '100%', maxWidth: size.contentMax, alignSelf: 'center', gap: 8 }}>
        {row ? (
          <View style={styles.btnrow}>
            {/* Buttons fill their cell (ButtonFillContext); cells share the row, wrap under 120 each. */}
            <ButtonFillContext value={true}>
              {Children.map(children, (c) => (c ? <View style={styles.btnCell}>{c}</View> : null))}
            </ButtonFillContext>
          </View>
        ) : (
          children
        )}
        {hint ? (
          <Txt variant="caption" color="inkMuted" align="center">
            {hint}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

/** Applicant mode bar (S-08a…S-08b): indigo strip with the title and a lock button back to the landlord. */
export function ModeBar({ title, actionLabel, onAction }: { title: string; actionLabel: string; onAction: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.modebar, { backgroundColor: colors.accent, paddingTop: insets.top + 6 }]}>
      <Txt style={[font(600, 14, 20), { color: colors.onAccent, flex: 1 }]}>{title}</Txt>
      <Pressable
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={styles.lockFrame}
      >
        {({ pressed }) => (
          <View style={[styles.lock, { backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)' }]}>
            <Glyph name="lock" size={16} color={colors.onAccent} strokeWidth={2} />
            <Txt style={[font(600, 13, 18), { color: colors.onAccent }]}>{actionLabel}</Txt>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { width: '100%', alignSelf: 'center', paddingTop: 4, paddingHorizontal: 16, gap: 16 },
  appbar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingTop: 4, paddingBottom: 8, paddingHorizontal: 16 },
  side: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  sideRight: { justifyContent: 'flex-end' },
  sideLeft: { minWidth: TOUCH_MIN },
  rightContent: { flexDirection: 'row', alignItems: 'center', flexShrink: 0 },
  titleBox: { flex: 1, minWidth: 0 },
  large: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  heroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  btnbar: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  btnrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  btnCell: { flexGrow: 1, flexBasis: 120 },
  modebar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingBottom: 2, paddingLeft: 16, paddingRight: 12 },
  lockFrame: { minHeight: TOUCH_MIN, justifyContent: 'center' }, // B-75: 48 frame around the 34 pill
  lock: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17 },
});
