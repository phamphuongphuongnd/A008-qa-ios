/**
 * S-11 Landlord reference — one call sheet per Residence (product.md §5 S-11, mockup v2 "References").
 * Step 1 find the real owner · red flags (engine) · step 2 call script (9 questions) · attempts log → unreachable ·
 * "Email a verification request" (mail app; Evenlease sends nothing). Each answer is saved as it is chosen.
 */
import { useLocalSearchParams } from 'expo-router';
import { Info, Mail, Search } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { AppBar, Banner, Button, Checkbox, ChoicePills, FieldShell, MoneyField, Screen, Switch, TextField, Txt, showSnackbar, useDiscardGuard } from '@/ui';

import { ANSWER3, CONFIRM_SOURCES, LEFT_UNIT, PAID_ON_TIME, PROPER_NOTICE, type LandlordForm } from '../landlord';
import { parseMoneyInput, moneyInputText } from '../common';
import { AttemptsSection } from '../components/AttemptsSection';
import { fieldError, Hint, MonthField, NotFoundScreen, Question, RedFlagsCard, StepCard } from '../components/VerifyParts';
import { useSheetForm } from '../components/useSheetForm';
import { useLandlordSheet, verifyActions } from '../hooks';
import type { LandlordSheet } from '../service';
import { landlordView, saveOwesNow } from '../viewModels';

const opts = <T extends string>(values: readonly T[], group: string) =>
  values.map((v) => ({ value: v, label: t(`verify:landlord.${group}.${v}` as 'verify:landlord.answer3.yes') }));

export default function LandlordReferenceScreen() {
  const p = useLocalSearchParams<{ applicantId: string; residenceId: string }>();
  const applicantId = Number(p.applicantId);
  const residenceId = Number(p.residenceId);
  const sheet = useLandlordSheet(applicantId, residenceId);
  if (!sheet) return <NotFoundScreen title={t('verify:s11.title')} />;
  return <LandlordSheetView sheet={sheet} />;
}

export function LandlordSheetView({ sheet }: { sheet: LandlordSheet }) {
  const { applicant, residence } = sheet;
  const { form, errors, dirty, edit, commit } = useSheetForm<LandlordForm>(sheet.form, `${applicant.id}:${residence.id}`, (f) =>
    verifyActions.saveLandlord(applicant.id, residence.id, f),
  );
  const guard = useDiscardGuard(dirty);
  const err = (f: keyof LandlordForm) => fieldError(errors, f);
  const view = landlordView(sheet, form);
  const refId = () => sheet.reference?.id ?? verifyActions.ensureLandlordRef(applicant.id, residence.id);
  const money = (text: string) => {
    const c = parseMoneyInput(text);
    return c === null || Number.isNaN(c) ? null : c;
  };

  const open = async (url: string, failKey: 'verify:common.noBrowser' | 'verify:landlord.noMailApp') => {
    if (!(await verifyActions.openUrl(url))) showSnackbar({ message: t(failKey) });
  };

  return (
    <Screen header={<AppBar title={t('verify:s11.title')} subtitle={view.subtitle} />}>
      {guard}
      {view.showBothTip ? (
        <Banner tone="info" icon={Info}>
          {t('verify:landlord.bothTip')}
        </Banner>
      ) : null}

      <StepCard n={1} title={t('verify:landlord.step1')}>
        <Txt variant="callout" color="inkMuted">{t('verify:landlord.step1Body')}</Txt>
        <Button label={t('verify:landlord.searchCounty')} icon={Search} variant="secondary" block onPress={() => open(sheet.countySearchUrl, 'verify:common.noBrowser')} />
        <FieldShell label={t('verify:landlord.howConfirmed')} error={err('confirmSource')}>
          <ChoicePills
            options={opts(CONFIRM_SOURCES, 'confirmSource')}
            value={form.confirmSource}
            onChange={(v) => commit({ confirmSource: v === form.confirmSource ? null : v })}
            accessibilityLabel={t('verify:landlord.howConfirmed')}
          />
        </FieldShell>
        <View style={styles.switchRow}>
          <Txt variant="callout" style={{ flex: 1 }}>{t('verify:landlord.ownerConfirmed')}</Txt>
          <Switch value={form.ownerConfirmed} onChange={(v) => commit({ ownerConfirmed: v })} accessibilityLabel={t('verify:landlord.ownerConfirmed')} />
        </View>
        <TextField
          label={t('verify:landlord.contactName')}
          value={form.contactName}
          onChangeText={(s) => edit({ contactName: s })}
          onBlur={() => commit()}
          autoComplete="off"
        />
        <TextField
          label={t('verify:landlord.contactPhone')}
          value={form.contactPhone}
          keyboardType="phone-pad"
          onChangeText={(s) => edit({ contactPhone: s })}
          onBlur={() => commit()}
          autoComplete="off"
        />
      </StepCard>

      <RedFlagsCard flags={view.redFlags} />

      <StepCard n={2} title={t('verify:landlord.step2')}>
        <Question
          label={view.q1}
          options={opts(ANSWER3, 'answer3')}
          value={form.rentedFromYou}
          onChange={(v) => commit({ rentedFromYou: v })}
        />
        <FieldShell label={t('verify:landlord.q2')} error={err('to')}>
          <View style={styles.pair}>
            <View style={styles.pairCell}>
              <MonthField label={t('verify:landlord.from')} value={form.from} error={err('from')} onCommit={(from) => commit({ from })} />
            </View>
            <View style={styles.pairCell}>
              <MonthField
                label={t('verify:landlord.to')}
                value={form.to === 'still_there' ? null : form.to}
                disabled={view.toDisabled}
                onCommit={(to) => commit({ to })}
              />
            </View>
          </View>
          <Checkbox label={t('verify:landlord.q2Still')} value={form.to === 'still_there'} onChange={(v) => commit({ to: v ? 'still_there' : null })} />
        </FieldShell>
        <MoneyField
          label={t('verify:landlord.q3')}
          cents={money(form.rentText)}
          error={err('rentText')}
          onChangeCents={(c) => edit({ rentText: moneyInputText(c) })}
          onBlur={() => commit()}
        />
        <Question label={t('verify:landlord.q4')} options={opts(PAID_ON_TIME, 'paidOnTime')} value={form.paidOnTime} onChange={(v) => commit({ paidOnTime: v })} />
        <Question
          label={t('verify:landlord.q5')}
          options={opts(['no', 'yes'] as const, 'yesNo')}
          value={form.violations}
          onChange={(v) => commit({ violations: v })}
        />
        {view.showViolationsNote ? (
          <TextField label={t('verify:landlord.q5Note')} value={form.violationsNote} multiline onChangeText={(s) => edit({ violationsNote: s })} onBlur={() => commit()} />
        ) : null}
        <Question label={t('verify:landlord.q6')} options={opts(LEFT_UNIT, 'leftUnit')} value={form.leftUnit} onChange={(v) => commit({ leftUnit: v })} />
        <Question label={t('verify:landlord.q7')} options={opts(PROPER_NOTICE, 'properNotice')} value={form.properNotice} onChange={(v) => commit({ properNotice: v })} />
        <Question
          label={t('verify:landlord.q8')}
          options={opts(['no', 'yes', 'wouldnt_say'] as const, 'owes')}
          value={form.owes}
          onChange={(v) => (saveOwesNow(v) ? commit({ owes: v }) : edit({ owes: v }))}
        />
        {view.showOwesAmount ? (
          <MoneyField
            label={t('verify:landlord.q8Amount')}
            required
            cents={money(form.owesText)}
            error={err('owesText')}
            onChangeCents={(c) => edit({ owesText: moneyInputText(c) })}
            onBlur={() => commit()}
          />
        ) : null}
        <Question label={t('verify:landlord.q9')} options={opts(ANSWER3, 'answer3')} value={form.rentAgain} onChange={(v) => commit({ rentAgain: v })} />
        {view.showRentAgainWhy ? (
          <TextField label={t('verify:landlord.q9Why')} value={form.rentAgainWhy} multiline onChangeText={(s) => edit({ rentAgainWhy: s })} onBlur={() => commit()} />
        ) : null}
        <TextField label={t('verify:common.notes')} value={form.notes} multiline onChangeText={(s) => edit({ notes: s })} onBlur={() => commit()} />
      </StepCard>

      <AttemptsSection
        attempts={sheet.attempts}
        unreachable={sheet.unreachable}
        onLog={(input) => verifyActions.logAttempt(refId(), input)}
        onDelete={(id) => sheet.reference && verifyActions.removeAttempt(id, sheet.reference.id)}
        onMarkUnreachable={() => sheet.reference && verifyActions.markUnreachable(sheet.reference.id)}
        onClearUnreachable={() => sheet.reference && verifyActions.clearUnreachable(sheet.reference.id)}
      />

      <Button label={t('verify:landlord.email')} icon={Mail} variant="tonal" block onPress={() => open(sheet.email.url, 'verify:landlord.noMailApp')} />
      <Hint>{t('verify:landlord.emailHint')}</Hint>
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pairCell: { flexGrow: 1, flexBasis: 130 },
});
