/**
 * S-14 Background review (step 2) — product.md §3.11, §5 S-14, mockup v2 "Background". Locked until a Conditional
 * offer; convictions only (no arrests); any conviction in the lookback is "Needs review" — never an automatic denial.
 * "Withdraw the offer" needs the individual assessment and continues to the Decision sheet (S-15).
 */
import { useLocalSearchParams } from 'expo-router';
import { Ban, Lock, Plus, Scale, Trash2, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import {
  AppBar,
  Banner,
  Button,
  ButtonBar,
  Card,
  Chip,
  ChoicePills,
  DateField,
  EmptyState,
  FieldShell,
  IconButton,
  Screen,
  SectionHeader,
  Segmented,
  StatusBadge,
  TextButton,
  TextField,
  Txt,
  haptics,
  showSnackbar,
  useDiscardGuard,
} from '@/ui';

import { CONVICTION_TYPES, backgroundState, emptyConviction, type BackgroundForm, type ConvictionsMode, type OutcomeBlock } from '../background';
import { localDate, monthYearOfDate, type FieldError } from '../common';
import { errorText, fieldError, Hint, NotFoundScreen } from '../components/VerifyParts';
import { useSheetForm } from '../components/useSheetForm';
import { useBackgroundSheet, verifyActions } from '../hooks';
import type { BackgroundSheet } from '../service';

export default function BackgroundReviewScreen() {
  const p = useLocalSearchParams<{ applicantId: string }>();
  const sheet = useBackgroundSheet(Number(p.applicantId));
  if (!sheet) return <NotFoundScreen title={t('verify:s14.title')} />;
  return <BackgroundSheetView sheet={sheet} />;
}

// TODO(merge 2C): guide slug for "Criminal history laws by city" is 2E's (src/features/guide); confirm the slug.
const LAWS_ARTICLE = 'criminal-history';

export function BackgroundSheetView({ sheet, now = new Date() }: { sheet: BackgroundSheet; now?: Date }) {
  const { applicant, gate } = sheet;
  const today = localDate(now);
  const editable = gate === 'open';
  const { form, errors, dirty, edit, commit } = useSheetForm<BackgroundForm>(sheet.form, String(applicant.id), (f) => {
    const r = verifyActions.saveBackground(applicant.id, f);
    return r.ok ? r : { ok: false, errors: r.errors as FieldError[] };
  });
  const guard = useDiscardGuard(dirty && editable);
  const header = (
    <AppBar
      title={t('verify:s14.title')}
      subtitle={gate === 'open' || gate === 'read_only' ? t('verify:background.subtitleAfterOffer', { name: applicant.fullName }) : applicant.fullName}
    />
  );

  if (gate === 'locked' || gate === 'not_in_criteria') {
    const locked = gate === 'locked';
    return (
      <Screen header={header}>
        <EmptyState
          icon={locked ? Lock : Ban}
          title={t(locked ? 'verify:background.lockedTitle' : 'verify:background.offTitle')}
          body={t(locked ? 'verify:background.lockedBody' : 'verify:background.offBody')}
          secondary={{ label: t('verify:background.lawsLink'), onPress: () => router.push(routes.guideArticle(LAWS_ARTICLE)) }}
        />
      </Screen>
    );
  }

  const state = backgroundState(form, { gate, lookbackYears: sheet.lookbackYears, conditionalOfferAt: sheet.conditionalOfferAt, today });
  const err = (f: string) => fieldError(errors, f);
  const setConviction = (i: number, patch: Partial<BackgroundForm['convictions'][number]>, save: boolean) => {
    const convictions = form.convictions.map((c, j) => (j === i ? { ...c, ...patch } : c));
    return save ? commit({ convictions }) : edit({ convictions });
  };
  const blockText = (b: OutcomeBlock | null) => (b && b !== 'not_editable' ? t(`verify:background.block.${b}`) : undefined);

  const choose = (outcome: 'continue' | 'withdraw') => {
    const r = verifyActions.chooseBackgroundOutcome(applicant.id, form, outcome);
    if (!r.ok) {
      haptics.error();
      showSnackbar({ message: r.block ? t(`verify:background.block.${r.block}`) : errorText(r.errors[0]?.code ?? 'required') });
      return;
    }
    haptics.success();
    if (outcome === 'withdraw') {
      // TODO(merge 2C): routes.decision(applicantId, { kind: 'withdraw_offer' }) once src/routes.ts has the param.
      router.push(routes.decision(applicant.id));
    } else {
      showSnackbar({ message: t('verify:background.continued') });
      router.back();
    }
  };

  // The latest conviction in the lookback drives "How long ago was it?".
  const inLookback = state.convictions.filter((c) => c.inLookback);
  const latest = inLookback.slice().sort((a, b) => (a.conviction.convictedOn < b.conviction.convictedOn ? 1 : -1))[0];

  return (
    <Screen
      header={header}
      footer={
        editable ? (
          <ButtonBar row hint={blockText(state.withdrawBlock === 'no_convictions_in_lookback' ? null : state.withdrawBlock) ?? blockText(state.continueBlock)}>
            <Button label={t('verify:background.continue')} variant="secondary" disabled={!!state.continueBlock} onPress={() => choose('continue')} />
            {state.needsAssessment ? (
              <Button label={t('verify:background.withdraw')} variant="dangerOutline" disabled={!!state.withdrawBlock} onPress={() => choose('withdraw')} />
            ) : null}
          </ButtonBar>
        ) : undefined
      }
    >
      {guard}
      <Banner tone="warn" icon={TriangleAlert}>
        {t('verify:background.lawBanner')}
      </Banner>
      {gate === 'read_only' ? (
        <Banner tone="info" icon={Scale}>
          {t('verify:background.readOnly')}
        </Banner>
      ) : null}

      <FieldShell label={t('verify:background.convictionsIn', { count: sheet.lookbackYears })} help={t('verify:background.arrests')} error={err('mode')}>
        <Segmented
          options={[
            { value: 'none' as ConvictionsMode, label: t('verify:background.none'), accessibilityLabel: t('verify:background.noneA11y', { count: sheet.lookbackYears }) },
            { value: 'listed' as ConvictionsMode, label: t('verify:background.add') },
          ]}
          value={form.mode === 'not_entered' ? (null as unknown as ConvictionsMode) : form.mode}
          onChange={(v) => {
            if (!editable) return;
            if (v === 'none') commit({ mode: v });
            else edit({ mode: v, convictions: form.convictions.length ? form.convictions : [emptyConviction()] });
          }}
          accessibilityLabel={t('verify:background.convictionsIn', { count: sheet.lookbackYears })}
        />
      </FieldShell>

      {form.mode === 'listed'
        ? form.convictions.map((c, i) => {
            const view = state.convictions.find((v) => v.conviction.convictedOn === c.convictedOn && v.conviction.type === c.type);
            const typeLabel = c.type ? t(`verify:background.convictionType.${c.type}`) : t('verify:background.convictionN', { n: i + 1 });
            return (
              <Card key={i}>
                <View style={styles.row}>
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>{typeLabel}</Txt>
                  {view ? (
                    view.inLookback ? <StatusBadge outcome="needs_review" /> : <Chip size="sm" label={t('verify:background.outside', { count: sheet.lookbackYears })} />
                  ) : null}
                  {editable ? (
                    <IconButton
                      icon={Trash2}
                      accessibilityLabel={t('verify:background.removeConviction', { n: i + 1 })}
                      onPress={() => commit({ convictions: form.convictions.filter((_, j) => j !== i) })}
                    />
                  ) : null}
                </View>
                {view ? (
                  <Txt variant="caption" color="inkMuted">
                    {c.sentenceEndedOn
                      ? t('verify:background.lineWithSentence', { convicted: monthYearOfDate(view.conviction.convictedOn), ended: monthYearOfDate(c.sentenceEndedOn) })
                      : t('verify:background.line', { convicted: monthYearOfDate(view.conviction.convictedOn) })}
                  </Txt>
                ) : null}
                {editable ? (
                  <>
                    <FieldShell label={t('verify:background.type')} error={err(`convictions.${i}.type`)}>
                      <ChoicePills
                        options={CONVICTION_TYPES.map((v) => ({ value: v, label: t(`verify:background.convictionType.${v}`) }))}
                        value={c.type}
                        onChange={(type) => setConviction(i, { type }, true)}
                        accessibilityLabel={t('verify:background.type')}
                      />
                    </FieldShell>
                    <DateField
                      label={t('verify:background.convictedOn')}
                      value={c.convictedOn}
                      maximumDate={today}
                      error={err(`convictions.${i}.convictedOn`)}
                      onChange={(d) => setConviction(i, { convictedOn: d }, true)}
                    />
                    <DateField
                      label={t('verify:background.sentenceEndedOn')}
                      value={c.sentenceEndedOn}
                      maximumDate={today}
                      error={err(`convictions.${i}.sentenceEndedOn`)}
                      onChange={(d) => setConviction(i, { sentenceEndedOn: d }, true)}
                    />
                  </>
                ) : null}
              </Card>
            );
          })
        : null}
      {form.mode === 'listed' && editable ? (
        <TextButton label={t('verify:background.addConviction')} onPress={() => edit({ convictions: [...form.convictions, emptyConviction()] })} />
      ) : null}

      {state.needsAssessment ? (
        <>
          <SectionHeader title={t('verify:background.assessmentTitle')} />
          <TextField
            label={t('verify:background.q1')}
            value={form.seriousness}
            multiline
            disabled={!editable}
            placeholder={t('verify:background.notesPlaceholder')}
            onChangeText={(s) => edit({ seriousness: s })}
            onBlur={() => commit()}
          />
          <FieldShell label={t('verify:background.q2')}>
            <Txt tabular accessibilityLabel={latest ? `${latest.howLongAgo} ${t('verify:background.calculated')}` : undefined}>
              {latest ? `${latest.howLongAgo} ${t('verify:background.calculated')}` : '—'}
            </Txt>
          </FieldShell>
          <TextField
            label={t('verify:background.q3')}
            value={form.rehabilitation}
            multiline
            disabled={!editable}
            placeholder={t('verify:background.notesPlaceholder')}
            onChangeText={(s) => edit({ rehabilitation: s })}
            onBlur={() => commit()}
          />
          <TextField
            label={t('verify:background.q4')}
            value={form.other}
            multiline
            disabled={!editable}
            placeholder={t('verify:background.notesPlaceholder')}
            onChangeText={(s) => edit({ other: s })}
            onBlur={() => commit()}
          />
          <Hint>{t('verify:background.neverAuto')}</Hint>
        </>
      ) : null}
      {form.mode === 'listed' && !state.needsAssessment && state.convictions.length > 0 ? <Hint>{t('verify:background.noneInLookback')}</Hint> : null}
      {editable && form.mode === 'listed' && form.convictions.length === 0 ? (
        <Button label={t('verify:background.addConviction')} icon={Plus} variant="secondary" block onPress={() => edit({ convictions: [emptyConviction()] })} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
