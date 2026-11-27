/**
 * S-14 Background review (step 2) — product.md §3.11, §5 S-14, mockup v2 "Background". Locked until a Conditional
 * offer; convictions only (no arrests); any conviction in the lookback is "Needs review" — never an automatic denial.
 * "Withdraw the offer" needs the individual assessment and continues to the Decision sheet (S-15, withdraw_offer).
 * What is shown / enabled comes from `backgroundView` (../viewModels).
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

import { CONVICTION_TYPES, emptyConviction, type BackgroundForm, type ConvictionsMode } from '../background';
import { localDate, type FieldError } from '../common';
import { errorText, fieldError, Hint, NotFoundScreen } from '../components/VerifyParts';
import { useSheetForm } from '../components/useSheetForm';
import { useBackgroundSheet, verifyActions } from '../hooks';
import type { BackgroundSheet } from '../service';
import { CRIMINAL_HISTORY_ARTICLE, backgroundNext, backgroundView } from '../viewModels';

export default function BackgroundReviewScreen() {
  const p = useLocalSearchParams<{ applicantId: string }>();
  const sheet = useBackgroundSheet(Number(p.applicantId));
  if (!sheet) return <NotFoundScreen title={t('verify:s14.title')} />;
  return <BackgroundSheetView sheet={sheet} />;
}

export function BackgroundSheetView({ sheet, now = new Date() }: { sheet: BackgroundSheet; now?: Date }) {
  const { applicant } = sheet;
  const today = localDate(now);
  const { form, errors, dirty, edit, commit, savedThen } = useSheetForm<BackgroundForm>(sheet.form, String(applicant.id), (f) => {
    const r = verifyActions.saveBackground(applicant.id, f);
    return r.ok ? r : { ok: false, errors: r.errors as FieldError[] };
  });
  const view = backgroundView(sheet, form, today);
  const guard = useDiscardGuard(dirty && view.kind === 'review' && view.editable);
  const header = <AppBar title={t('verify:s14.title')} subtitle={view.subtitle} />;

  if (view.kind === 'empty') {
    return (
      <Screen header={header}>
        <EmptyState
          icon={view.icon === 'lock' ? Lock : Ban}
          title={view.title}
          body={view.body}
          secondary={{ label: t('verify:background.lawsLink'), onPress: () => router.push(routes.guideArticle(CRIMINAL_HISTORY_ARTICLE)) }}
        />
      </Screen>
    );
  }

  const { editable } = view;
  const err = (f: string) => fieldError(errors, f);
  const setConviction = (i: number, patch: Partial<BackgroundForm['convictions'][number]>) =>
    commit({ convictions: form.convictions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  const choose = (outcome: 'continue' | 'withdraw') => {
    const r = verifyActions.chooseBackgroundOutcome(applicant.id, form, outcome);
    if (!r.ok) {
      haptics.error();
      showSnackbar({ message: r.block ? t(`verify:background.block.${r.block}`) : errorText(r.errors[0]?.code ?? 'required') });
      return;
    }
    haptics.success();
    // B-122: the outcome saved the form too — mark it saved and navigate once the discard guard is off.
    const next = backgroundNext(outcome, applicant.id);
    savedThen(() => {
      if (next.kind === 'push') router.push(next.href);
      else {
        showSnackbar({ message: t('verify:background.continued') });
        router.back();
      }
    });
  };

  return (
    <Screen
      header={header}
      footer={
        view.footer.show ? (
          <ButtonBar row hint={view.footer.hint}>
            <Button label={t('verify:background.continue')} variant="secondary" disabled={view.footer.continueDisabled} onPress={() => choose('continue')} />
            {view.footer.showWithdraw ? (
              <Button label={t('verify:background.withdraw')} variant="dangerOutline" disabled={view.footer.withdrawDisabled} onPress={() => choose('withdraw')} />
            ) : null}
          </ButtonBar>
        ) : undefined
      }
    >
      {guard}
      <Banner tone="warn" icon={TriangleAlert}>
        {t('verify:background.lawBanner')}
      </Banner>
      {view.readOnly ? (
        <Banner tone="info" icon={Scale}>
          {t('verify:background.readOnly')}
        </Banner>
      ) : null}

      <FieldShell label={view.modeLabel} help={t('verify:background.arrests')} error={err('mode')}>
        <Segmented
          options={[
            { value: 'none' as ConvictionsMode, label: t('verify:background.none'), accessibilityLabel: view.noneA11y },
            { value: 'listed' as ConvictionsMode, label: t('verify:background.add') },
          ]}
          value={view.modeValue as ConvictionsMode}
          onChange={(v) => {
            if (!editable) return;
            if (v === 'none') commit({ mode: v });
            else edit({ mode: v, convictions: form.convictions.length ? form.convictions : [emptyConviction()] });
          }}
          accessibilityLabel={view.modeLabel}
        />
      </FieldShell>

      {view.cards.map((card) => {
        const c = form.convictions[card.index];
        const i = card.index;
        return (
          <Card key={i}>
            <View style={styles.row}>
              <Txt variant="bodyStrong" style={{ flex: 1 }}>{card.title}</Txt>
              {card.badge === 'needs_review' ? <StatusBadge outcome="needs_review" /> : card.badge === 'outside' ? <Chip size="sm" label={card.outsideLabel} /> : null}
              {editable ? (
                <IconButton
                  icon={Trash2}
                  accessibilityLabel={t('verify:background.removeConviction', { n: i + 1 })}
                  onPress={() => commit({ convictions: form.convictions.filter((_, j) => j !== i) })}
                />
              ) : null}
            </View>
            {card.line ? <Txt variant="caption" color="inkMuted">{card.line}</Txt> : null}
            {editable ? (
              <>
                <FieldShell label={t('verify:background.type')} error={err(`convictions.${i}.type`)}>
                  <ChoicePills
                    options={CONVICTION_TYPES.map((v) => ({ value: v, label: t(`verify:background.convictionType.${v}`) }))}
                    value={c.type}
                    onChange={(type) => setConviction(i, { type })}
                    accessibilityLabel={t('verify:background.type')}
                  />
                </FieldShell>
                <DateField
                  label={t('verify:background.convictedOn')}
                  value={c.convictedOn}
                  maximumDate={today}
                  error={err(`convictions.${i}.convictedOn`)}
                  onChange={(d) => setConviction(i, { convictedOn: d })}
                />
                <DateField
                  label={t('verify:background.sentenceEndedOn')}
                  value={c.sentenceEndedOn}
                  maximumDate={today}
                  error={err(`convictions.${i}.sentenceEndedOn`)}
                  onChange={(d) => setConviction(i, { sentenceEndedOn: d })}
                />
              </>
            ) : null}
          </Card>
        );
      })}
      {form.mode === 'listed' && editable ? (
        form.convictions.length ? (
          <TextButton label={t('verify:background.addConviction')} onPress={() => edit({ convictions: [...form.convictions, emptyConviction()] })} />
        ) : (
          <Button label={t('verify:background.addConviction')} icon={Plus} variant="secondary" block onPress={() => edit({ convictions: [emptyConviction()] })} />
        )
      ) : null}

      {view.showAssessment ? (
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
            <Txt tabular>{view.howLongAgo}</Txt>
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
      {view.showNoneInLookback ? <Hint>{t('verify:background.noneInLookback')}</Hint> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
