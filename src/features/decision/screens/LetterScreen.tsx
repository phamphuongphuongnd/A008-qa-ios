/**
 * S-16 Letter (F-14) — product.md §5 S-16, mockup v2 "Conditional offer · mark as sent" / "Adverse action notice".
 * The on-screen letter has the same parts as the PDF (`letterPaper`); the opening and closing paragraphs are editable,
 * the FCRA block is locked. Share prints the PDF (copy kept with the applicant's files), Mark as sent stores date + how.
 * Share / preview run under App lock suspension (2E) so the lock does not cut in while the system sheet is open.
 */
import { useLocalSearchParams, type Href } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { LetterKind } from '@/engine';
import type { SentMethod } from '@/db/schema';
import { withLockSuspended } from '@/features/settings/lockController';
import { GUIDE } from '@/features/guide/articles';
import { GuideLink } from '@/features/guide/components/GuideLink';
import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import { useTheme } from '@/theme';
import {
  AppBar,
  Banner,
  Button,
  ButtonBar,
  Card,
  Chip,
  ChoicePills,
  LegalFooter,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  TextButton,
  TextField,
  Txt,
  haptics,
  showSnackbar,
} from '@/ui';

import { letterDeps } from '../deps';
import { useLetterContext } from '../hooks';
import { buildLetterInput, exportLetter, letterDocument, letterText, markSent, type LetterBody, type LetterContext } from '../letters';
import { previewPdf } from '../native';
import { localDate } from '../time';
import { letterPaper, letterScreenView, pickLetterKind, SENT_METHODS } from '../viewModel';
import { idParam, NotFoundScreen } from '../components/DecisionParts';

export default function LetterScreen() {
  const p = useLocalSearchParams<{ id: string; decisionId?: string; kind?: string }>();
  const ctx = useLetterContext(idParam(p.id), idParam(p.decisionId));
  if (!ctx || !ctx.kinds.length) return <NotFoundScreen title={t('decision:s16.title')} />;
  return <Letter ctx={ctx} kindParam={p.kind} />;
}

function Letter({ ctx, kindParam }: { ctx: LetterContext; kindParam?: string }) {
  const applicantId = ctx.bundle.applicant.id;
  const decisionId = ctx.decisionRow.id;
  const [kind, setKind] = useState<LetterKind>(() => pickLetterKind(ctx.kinds, kindParam));
  const [bodies, setBodies] = useState<Partial<Record<LetterKind, LetterBody>>>({});
  const [editing, setEditing] = useState<LetterBody | null>(null);
  const [method, setMethod] = useState<SentMethod | null>(null);
  const [busy, setBusy] = useState(false);
  const { colors } = useTheme();

  const today = localDate(new Date());
  const body = bodies[kind] ?? letterText(ctx, kind);
  const view = letterScreenView(ctx, kind, method, today);
  const paper = letterPaper(buildLetterInput(ctx, kind, body, today));

  const share = async () => {
    setBusy(true);
    try {
      const r = await withLockSuspended(() => exportLetter(letterDeps, { applicantId, decisionId, kind, body }));
      if (!r.ok) {
        haptics.error();
        showSnackbar({ message: r.message });
      }
    } catch {
      haptics.error();
      showSnackbar({ message: t('decision:s16.pdfFailed') });
    } finally {
      setBusy(false);
    }
  };

  const preview = () =>
    withLockSuspended(() => previewPdf(letterDocument(ctx, kind, body, today))).catch(() => showSnackbar({ message: t('decision:s16.pdfFailed') }));

  const mark = () => {
    if (!method) return;
    const r = markSent(letterDeps, { applicantId, decisionId, kind, body, method });
    if (!r.ok) {
      haptics.error();
      showSnackbar({ message: r.message });
      return;
    }
    haptics.success();
    showSnackbar({ message: t('decision:s16.sentDone') });
  };

  return (
    <Screen
      header={<AppBar title={view.title} subtitle={view.subtitle} />}
      footer={
        <ButtonBar row>
          <Button label={t('decision:s16.share')} variant="secondary" disabled={!view.canShare} loading={busy} onPress={share} />
          <Button label={view.markLabel} disabled={!view.canMarkSent} onPress={mark} />
        </ButtonBar>
      }
    >
      {view.kinds ? (
        <Segmented options={view.kinds} value={kind} onChange={setKind} accessibilityLabel={t('decision:s16.title')} />
      ) : null}
      {view.blocked ? (
        <Banner tone="warn" actions={[{ label: t('decision:s16.openReport'), onPress: () => router.push(view.blocked!.href as Href) }]}>
          {view.blocked.message}
        </Banner>
      ) : null}
      {view.landlordNameMissing ? (
        <Banner tone="info" actions={[{ label: t('decision:s16.openSettings'), onPress: () => router.push(routes.settings()) }]}>
          {t('decision:s16.nameMissing')}
        </Banner>
      ) : null}
      {view.sent ? <Chip label={view.sent} tone="accent" /> : null}

      {/* The letter, as printed. */}
      <Card>
        <View style={{ gap: 10 }}>
          <Txt color="inkMuted">{paper.dateText}</Txt>
          <View>
            {paper.recipient.map((l) => (
              <Txt key={l}>{l}</Txt>
            ))}
          </View>
          <Txt variant="bodyStrong">{paper.re}</Txt>
          <Txt>{paper.dear}</Txt>
          <Txt>{paper.opening}</Txt>
          {paper.conditions.length ? (
            <View>
              <Txt variant="bodyStrong">{t('decision:letters.conditionsLabel')}</Txt>
              {paper.conditions.map((c) => (
                <Txt key={c}>• {c}</Txt>
              ))}
            </View>
          ) : null}
          {paper.reasons ? (
            <View>
              <Txt variant="bodyStrong">{paper.reasons.label}</Txt>
              {paper.reasons.items.map((r) => (
                <Txt key={r}>{paper.reasons!.items.length > 1 ? `• ${r}` : r}</Txt>
              ))}
            </View>
          ) : null}
          {paper.replyBy ? <Txt>{paper.replyBy}</Txt> : null}
          {paper.fcra ? (
            <Card variant="tint">
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Lock size={14} color={colors.inkMuted} />
                  <Txt variant="caption" color="inkMuted">
                    {t('decision:s16.fcraLocked')}
                  </Txt>
                </View>
                {paper.fcra.company.map((l) => (
                  <Txt key={l} variant="bodyStrong">
                    {l}
                  </Txt>
                ))}
                {paper.fcra.lines.map((l) => (
                  <Txt key={l}>{l}</Txt>
                ))}
              </View>
            </Card>
          ) : null}
          {paper.score ? (
            <View>
              {paper.score.map((l) => (
                <Txt key={l}>{l}</Txt>
              ))}
            </View>
          ) : null}
          {paper.closing ? <Txt>{paper.closing}</Txt> : null}
          <View>
            {paper.signOff.map((l) => (
              <Txt key={l}>{l}</Txt>
            ))}
          </View>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <TextButton label={t('decision:s16.editText')} onPress={() => setEditing(body)} />
        <TextButton label={t('decision:s16.preview')} onPress={preview} />
      </View>
      {paper.fcra ? <GuideLink slug={GUIDE.adverseAction} /> : null}

      <View style={{ gap: 8 }}>
        <SectionHeader title={t('decision:s16.howSent')} />
        <ChoicePills
          options={SENT_METHODS.map((m) => ({ value: m, label: t(`decision:sentMethod.${m}`) }))}
          value={method}
          onChange={setMethod}
          accessibilityLabel={t('decision:s16.howSent')}
        />
      </View>
      <LegalFooter />

      <Sheet
        visible={!!editing}
        onClose={() => setEditing(null)}
        title={t('decision:s16.editText')}
        dirty={!!editing && (editing.opening !== body.opening || editing.closing !== body.closing)}
        footer={
          <Button
            label={t('common:actions.save')}
            block
            onPress={() => {
              setBodies((b) => ({ ...b, [kind]: editing! }));
              setEditing(null);
            }}
          />
        }
      >
        {editing ? (
          <View style={{ gap: 12 }}>
            <TextField label={t('decision:s16.openingLabel')} value={editing.opening} multiline onChangeText={(opening) => setEditing({ ...editing, opening })} />
            <TextField label={t('decision:s16.closingLabel')} value={editing.closing} multiline onChangeText={(closing) => setEditing({ ...editing, closing })} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
