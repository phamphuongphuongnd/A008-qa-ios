/**
 * S-12 Employer reference (product.md §5 S-12). Not in the mockup: built from the v2 design system in the same shape
 * as S-11 — step 1 find the number yourself · step 2 questions · fixed note · attempts log. Answers save as chosen.
 */
import { useLocalSearchParams } from 'expo-router';
import { Info } from 'lucide-react-native';

import { t } from '@/i18n';
import { AppBar, Banner, Screen, TextField, Txt, useDiscardGuard } from '@/ui';

import { EMPLOYED, type EmployerForm } from '../employer';
import { AttemptsSection } from '../components/AttemptsSection';
import { fieldError, MonthField, NotFoundScreen, Question, StepCard } from '../components/VerifyParts';
import { useSheetForm } from '../components/useSheetForm';
import { useEmployerSheet, verifyActions } from '../hooks';
import type { EmployerSheet } from '../service';
import { employerView } from '../viewModels';

export default function EmployerReferenceScreen() {
  const p = useLocalSearchParams<{ applicantId: string; incomeId: string }>();
  const sheet = useEmployerSheet(Number(p.applicantId), Number(p.incomeId));
  if (!sheet) return <NotFoundScreen title={t('verify:s12.title')} />;
  return <EmployerSheetView sheet={sheet} />;
}

export function EmployerSheetView({ sheet }: { sheet: EmployerSheet }) {
  const { applicant, income } = sheet;
  const { form, errors, dirty, edit, commit } = useSheetForm<EmployerForm>(sheet.form, `${applicant.id}:${income.id}`, (f) =>
    verifyActions.saveEmployer(applicant.id, income.id, f),
  );
  const guard = useDiscardGuard(dirty);
  const refId = () => sheet.reference?.id ?? verifyActions.ensureEmployerRef(applicant.id, income.id);
  const view = employerView(sheet, form);

  return (
    <Screen header={<AppBar title={t('verify:s12.title')} subtitle={view.subtitle} />}>
      {guard}
      <StepCard n={1} title={t('verify:employer.step1')}>
        <Txt variant="callout" color="inkMuted">{t('verify:employer.step1Body')}</Txt>
        <TextField label={t('verify:employer.contactName')} value={form.contactName} onChangeText={(s) => edit({ contactName: s })} onBlur={() => commit()} autoComplete="off" />
        <TextField
          label={t('verify:employer.contactPhone')}
          value={form.contactPhone}
          keyboardType="phone-pad"
          onChangeText={(s) => edit({ contactPhone: s })}
          onBlur={() => commit()}
          autoComplete="off"
        />
      </StepCard>

      <StepCard n={2} title={t('verify:employer.step2')}>
        <Question
          label={view.q1}
          options={EMPLOYED.map((v) => ({ value: v, label: t(`verify:employer.employed.${v}`) }))}
          value={form.employed}
          onChange={(v) => commit({ employed: v })}
        />
        {view.showSinceAndTitle ? (
          <>
            <MonthField label={t('verify:employer.q2')} value={form.since} error={fieldError(errors, 'since')} onCommit={(since) => commit({ since })} />
            <TextField label={t('verify:employer.q3')} value={form.title} onChangeText={(s) => edit({ title: s })} onBlur={() => commit()} />
          </>
        ) : null}
        <TextField label={t('verify:common.notes')} value={form.notes} multiline onChangeText={(s) => edit({ notes: s })} onBlur={() => commit()} />
      </StepCard>

      <Banner tone="info" icon={Info}>
        {t('verify:employer.note')}
      </Banner>

      <AttemptsSection
        attempts={sheet.attempts}
        unreachable={sheet.unreachable}
        onLog={(input) => verifyActions.logAttempt(refId(), input)}
        onDelete={(id) => sheet.reference && verifyActions.removeAttempt(id, sheet.reference.id)}
        onMarkUnreachable={() => sheet.reference && verifyActions.markUnreachable(sheet.reference.id)}
        onClearUnreachable={() => sheet.reference && verifyActions.clearUnreachable(sheet.reference.id)}
      />
    </Screen>
  );
}
