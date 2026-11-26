/**
 * S-19 Decision file (F-15) — product.md §5 S-19, mockup v2 "Decision file". On-screen summary of the PDF: criteria
 * history, applicants in the order received with "N of M Met" (shown only here, for everyone alike — Phương
 * 2026-11-26), the last decision, reasons and letters; deleted applicants keep one line. Thumbnails off by default.
 * Share = PDF to the share sheet; Export PDF = system print dialog (Save as PDF). Both under App lock suspension.
 */
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { db } from '@/db';
import { withLockSuspended } from '@/features/settings/lockController';
import { t } from '@/i18n';
import { decisionFileHtml } from '@/pdf/decisionFile';
import { AppBar, Button, ButtonBar, Card, LegalFooter, ListGroup, Screen, SectionHeader, SwitchRow, Txt, haptics, showSnackbar } from '@/ui';

import { buildDecisionFile, exportDecisionFile } from '../decisionFile';
import { useDecisionFileData } from '../hooks';
import { previewPdf, thumbnailReader } from '../native';
import { decisionFilePreview } from '../viewModel';
import { Hint, idParam, NotFoundScreen } from '../components/DecisionParts';

export default function DecisionFileScreen() {
  const p = useLocalSearchParams<{ id: string }>();
  const rentalId = idParam(p.id);
  const data = useDecisionFileData(rentalId);
  const [thumbs, setThumbs] = useState(false);
  const [busy, setBusy] = useState<'share' | 'export' | null>(null);
  if (!data || rentalId == null) return <NotFoundScreen title={t('decision:s19.title')} />;
  const view = decisionFilePreview(data);
  const opts = { thumbnails: thumbs ? thumbnailReader : null };

  const act = async (kind: 'share' | 'export') => {
    setBusy(kind);
    try {
      await withLockSuspended(async () => {
        if (kind === 'share') {
          const r = await exportDecisionFile({ db, now: () => new Date() }, rentalId, opts);
          if (!r.ok) throw new Error(r.error);
        } else {
          const input = await buildDecisionFile(db, rentalId, new Date(), opts);
          if (!input) throw new Error('not_found');
          await previewPdf(decisionFileHtml(input));
        }
      });
    } catch {
      haptics.error();
      showSnackbar({ message: t('decision:s19.pdfFailed') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      header={<AppBar title={view.title} subtitle={view.subtitle} />}
      footer={
        <ButtonBar row>
          <Button label={t('decision:s19.share')} variant="secondary" loading={busy === 'share'} disabled={!!busy} onPress={() => act('share')} />
          <Button label={t('decision:s19.export')} loading={busy === 'export'} disabled={!!busy} onPress={() => act('export')} />
        </ButtonBar>
      }
    >
      <View>
        <SectionHeader title={t('decision:decisionFile.history')} />
        <Card>
          {view.history.length ? (
            view.history.map((h) => <Txt key={h}>{h}</Txt>)
          ) : (
            <Hint>{t('decision:decisionFile.noHistory')}</Hint>
          )}
        </Card>
      </View>

      <View>
        <SectionHeader title={t('decision:decisionFile.applicants')} />
        {view.applicants.length ? (
          <View style={{ gap: 8 }}>
            {view.applicants.map((a) => (
              <Card key={a.key}>
                <Txt variant={a.deleted ? 'body' : 'bodyStrong'} color={a.deleted ? 'inkMuted' : 'ink'}>
                  {a.heading}
                </Txt>
                {a.lines.map((l, i) => (
                  <Txt key={`${i}:${l}`} variant="caption" color="inkMuted">
                    {l}
                  </Txt>
                ))}
              </Card>
            ))}
          </View>
        ) : (
          <Hint>{t('decision:s19.empty')}</Hint>
        )}
      </View>

      <ListGroup>
        <SwitchRow title={t('decision:s19.thumbnails')} value={thumbs} onChange={setThumbs} />
      </ListGroup>
      <LegalFooter />
    </Screen>
  );
}
