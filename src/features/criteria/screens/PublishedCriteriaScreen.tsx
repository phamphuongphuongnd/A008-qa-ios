/** S-05 Published criteria — product.md §5 S-05, mockup v2 "Published criteria · share to Zillow / Facebook". */
import { router, useLocalSearchParams } from 'expo-router';
import { Copy, FileDown, FileQuestion } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { parseId, routes } from '@/routes';
import { font, useTheme } from '@/theme';
import { AppBar, Button, ButtonBar, EmptyState, FormProgress, LegalFooter, Screen, TextButton, Txt, showSnackbar } from '@/ui';

import { usePublishedCriteria } from '../hooks';
import { paperModel } from '../screenModels';

export default function PublishedCriteriaScreen() {
  const { id, setup } = useLocalSearchParams<{ id: string; setup?: string }>();
  const rentalId = parseId(id) ?? -1;
  const isSetup = setup === '1';
  const pub = usePublishedCriteria(rentalId);
  const { colors, radius } = useTheme();
  const [busy, setBusy] = useState(false);

  if (pub.notFound || !pub.content) {
    return (
      <Screen header={<AppBar title={t('units:s05.title')} />}>
        <EmptyState icon={FileQuestion} title={t('units:s06.notFound')} />
      </Screen>
    );
  }
  const paper = paperModel(pub.content);

  const exportPdf = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await pub.sharePdf();
      if (!r.shared) showSnackbar({ message: t('units:s05.sharedNoSheet') });
    } catch {
      showSnackbar({ message: t('units:s05.pdfError') });
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    const ok = await pub.copy();
    showSnackbar({ message: t(ok ? 'units:s05.copied' : 'units:s05.copyFailed') });
  };
  const goToRental = () => {
    router.dismissAll();
    router.push(routes.rentalHub(rentalId));
  };

  return (
    <Screen
      background={colors.surface2}
      header={
        <>
          <AppBar
            title={t('units:s05.title')}
            right={<TextButton label={t('common:actions.edit')} accessibilityLabel={t('units:s05.edit')} onPress={() => router.push(routes.criteria(rentalId))} />}
          />
          {isSetup ? (
            <View style={styles.progress}>
              <FormProgress current={2} total={3} />
            </View>
          ) : null}
        </>
      }
      footer={
        <ButtonBar>
          <View style={styles.row}>
            <View style={styles.cell}>
              <Button variant="secondary" icon={Copy} label={t('units:s05.copyText')} onPress={copy} />
            </View>
            <View style={styles.cell}>
              <Button icon={FileDown} label={t('units:s05.exportPdf')} loading={busy} onPress={exportPdf} />
            </View>
          </View>
          {isSetup ? <Button variant="ghost" block label={t('units:s05.done')} onPress={goToRental} /> : null}
        </ButtonBar>
      }
    >
      <View style={[styles.paper, { backgroundColor: colors.surface1, borderRadius: radius.lg, borderColor: colors.line }]}>
        <Txt accessibilityRole="header" style={font(700, 20, 26)}>
          {paper.title}
        </Txt>
        <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{paper.meta}</Txt>

        <H>{t('units:published.weWillCheck')}</H>
        <View style={styles.list}>
          {paper.checks.map((c) => (
            <View key={c} style={styles.li}>
              <Txt style={font(400, 15, 22)}>•</Txt>
              <Txt style={[font(400, 15, 22), { flex: 1 }]}>{c}</Txt>
            </View>
          ))}
        </View>

        {paper.bring ? (
          <>
            <H>{t('units:published.bring')}</H>
            <Txt style={font(400, 15, 22)}>{paper.bring}</Txt>
          </>
        ) : null}
        {paper.howWeReview ? (
          <>
            <H>{t('units:published.howWeReview')}</H>
            <Txt style={font(400, 15, 22)}>{paper.howWeReview}</Txt>
          </>
        ) : null}
        <H>{t('units:published.goodToKnow')}</H>
        <Txt style={font(400, 15, 22)}>{paper.goodToKnow}</Txt>
        <View style={[styles.box, { borderColor: colors.line, backgroundColor: colors.surface0, borderRadius: radius.md }]}>
          <Txt style={[font(400, 13, 18), { color: colors.inkMuted }]}>{paper.fairHousing}</Txt>
        </View>
      </View>
      <LegalFooter />
    </Screen>
  );
}

function H({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Txt accessibilityRole="header" style={[font(700, 13, 18, 0.02), styles.h5, { color: colors.inkMuted }]}>
      {children}
    </Txt>
  );
}

const styles = StyleSheet.create({
  progress: { paddingHorizontal: 16, paddingBottom: 8 },
  paper: { padding: 20, gap: 8, borderWidth: 1 },
  h5: { textTransform: 'uppercase', marginTop: 10 },
  list: { gap: 4 },
  li: { flexDirection: 'row', gap: 8 },
  box: { marginTop: 10, padding: 12, borderWidth: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, flexBasis: 140 },
});
