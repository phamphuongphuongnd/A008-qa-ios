/**
 * S-01 Onboarding (product.md S-01, mockup v2 "S-01 · 3 pages, required"): illustration · page dots · title + subtitle;
 * "Skip" (pages 1–2) jumps to page 3; page 3 has the required tick and "Get started" / "Explore with a sample rental".
 */
import { useFocusEffect } from 'expo-router';
import { Phone, ShieldCheck, Scale, TriangleAlert } from 'lucide-react-native';
import { useCallback } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import type { Outcome } from '@/engine';
import { t } from '@/i18n';
import { landAfterOnboarding } from '@/navigation/onboardingLanding';
import { font, useTheme } from '@/theme';
import { Button, ButtonBar, Checkbox, PageDots, Screen, StatusBadge, TextButton, Txt } from '@/ui';

import { useOnboardingFlow } from '../hooks';
import { ONBOARDING_PAGES, onboardingPageText, type OnboardingPage } from '../onboarding';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const f = useOnboardingFlow();
  const { page, accepted } = f.state;
  const text = onboardingPageText(page);

  // Android back walks the pages back (on page 1 it leaves the app as usual).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (page === 0) return false;
        f.dispatch({ type: 'back' });
        return true;
      });
      return () => sub.remove();
    }, [page, f]),
  );

  const finish = (withSample: boolean) => {
    const r = withSample ? f.explore() : f.getStarted();
    // B-40: no navigation here — the root stack's onboarding guard swaps S-01 for the tabs once `onboarded` flips.
    if (r) landAfterOnboarding(r.next);
  };

  const footer =
    page < 2 ? (
      <ButtonBar>
        <Button label={t('system:s01.next')} onPress={() => f.dispatch({ type: 'next' })} block />
      </ButtonBar>
    ) : (
      // B-80: the required tick sits in the footer right above "Get started" (mockup S-01 p3), so it is on screen on an
      // iPhone SE / large text too; "Explore with a sample rental" is a text link (a disabled ghost button drew a big
      // grey block and pushed the tick under the footer).
      <ButtonBar hint={accepted ? undefined : t('system:s01.acceptFirst')}>
        <Checkbox label={t('system:s01.accept')} value={accepted} onChange={() => f.dispatch({ type: 'toggleAccepted' })} />
        <Button label={t('system:s01.getStarted')} onPress={() => finish(false)} disabled={!f.canFinish} loading={f.busy === 'start'} block />
        <View style={styles.link}>
          <TextButton label={t('system:s01.explore')} onPress={() => finish(true)} disabled={!f.canFinish} />
        </View>
      </ButtonBar>
    );

  return (
    <Screen footer={footer} contentStyle={styles.body}>
      <View style={styles.skipRow}>
        {f.showsSkip ? <TextButton label={t('system:s01.skip')} onPress={() => f.dispatch({ type: 'skip' })} /> : null}
      </View>
      <View
        style={[styles.art, page === 2 && styles.artShort, { backgroundColor: colors.accentSoft }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Art page={page} />
      </View>
      <PageDots count={ONBOARDING_PAGES} current={page} />
      <View style={styles.text}>
        <Txt accessibilityRole="header" style={font(700, 28, 34, -0.02)}>
          {text.title}
        </Txt>
        <Txt style={[font(400, 16, 24), { color: colors.inkMuted }]}>{text.subtitle}</Txt>
      </View>
    </Screen>
  );
}

const ROWS: { label: string; outcome: Outcome; shift: number }[] = [
  { label: 'Income: at least 3.0× the rent', outcome: 'met', shift: 0 },
  { label: '12 months of rental history', outcome: 'met', shift: 14 },
  { label: 'No eviction judgment in 5 years', outcome: 'needs_review', shift: 6 },
  { label: 'Required documents provided', outcome: 'met', shift: 20 },
];

/** Decorative pictures of the mockup (hidden from screen readers). */
function Art({ page }: { page: OnboardingPage }) {
  const { colors } = useTheme();
  const card = { backgroundColor: colors.surface1, borderColor: colors.line };
  if (page === 0) {
    return (
      <View style={styles.rows}>
        {ROWS.map((r) => (
          <View key={r.label} style={[styles.critRow, card, { transform: [{ translateX: r.shift }] }]}>
            <Txt numberOfLines={1} style={[font(500, 13, 18), { flexShrink: 1 }]}>
              {r.label}
            </Txt>
            <StatusBadge outcome={r.outcome} />
          </View>
        ))}
      </View>
    );
  }
  if (page === 1) {
    return (
      <View style={styles.fill}>
        <View style={[styles.phone, card]}>
          <View style={[styles.circle64, { backgroundColor: colors.accentSoft }]}>
            <ShieldCheck size={32} color={colors.accent} />
          </View>
          <View style={[styles.line, { backgroundColor: colors.line, width: 100 }]} />
          <View style={[styles.line, { backgroundColor: colors.line, width: 70 }]} />
        </View>
        <View style={[styles.bubble, { right: 40, top: 150, width: 72, height: 72, backgroundColor: colors.accent }]}>
          <Phone size={30} color={colors.onAccent} />
        </View>
        <View style={[styles.bubble, { left: 36, top: 180, width: 56, height: 56, backgroundColor: colors.warnSoft }]}>
          <TriangleAlert size={24} color={colors.warn} />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.fill, styles.artShort]}>
      <View style={[styles.paper, card]}>
        <View style={[styles.line8, { backgroundColor: colors.accent, width: '60%' }]} />
        {['90%', '75%', '85%', '60%'].map((w) => (
          <View key={w} style={[styles.line, { backgroundColor: colors.line, width: w as `${number}%` }]} />
        ))}
      </View>
      <View style={[styles.bubble, styles.stamp, { backgroundColor: colors.accent }]}>
        <Scale size={26} color={colors.onAccent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, gap: 20 },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end', minHeight: 44, marginHorizontal: -8 },
  art: { minHeight: 250, borderRadius: 28, overflow: 'hidden' },
  // Page 3 (mockup: 170) leaves room for the tick + two finish actions in the footer.
  artShort: { minHeight: 170 },
  link: { alignItems: 'center' },
  text: { gap: 10 },
  rows: { paddingHorizontal: 28, paddingTop: 36, paddingBottom: 24, gap: 10 },
  critRow: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
  },
  fill: { flex: 1, minHeight: 250 },
  phone: {
    position: 'absolute',
    alignSelf: 'center',
    top: 40,
    width: 150,
    height: 190,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  circle64: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  line: { height: 6, borderRadius: 3 },
  line8: { height: 8, borderRadius: 4 },
  bubble: { position: 'absolute', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  paper: {
    position: 'absolute',
    alignSelf: 'center',
    top: 28,
    width: 150,
    height: 150,
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    transform: [{ rotate: '-3deg' }],
  },
  stamp: { width: 56, height: 56, top: 110, left: '50%', marginLeft: 40 },
});
