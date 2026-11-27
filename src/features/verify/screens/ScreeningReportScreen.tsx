/**
 * S-13 Screening report (external) — product.md §5 S-13, mockup v2 "Enter report results". The applicant buys the report
 * from a licensed company (SSN never touches Evenlease); the landlord enters the key results, the company details the
 * FCRA letter needs, and attaches the PDF / photos. Criminal history is not here (S-14). Saved with "Save".
 */
import { useLocalSearchParams } from 'expo-router';
import { Camera, ExternalLink, FileText, FolderOpen, Image as ImageIcon, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { GUIDE } from '@/features/guide/articles';
import { GuideLink } from '@/features/guide/components/GuideLink';
import { t } from '@/i18n';
import { router } from '@/services/router';
import { useTheme } from '@/theme';
import {
  AppBar,
  Banner,
  Button,
  Card,
  Checkbox,
  ChoicePills,
  ConfirmDialog,
  DateField,
  FieldShell,
  IconButton,
  ListGroup,
  ListRow,
  MoneyField,
  Screen,
  SectionHeader,
  Segmented,
  TextButton,
  TextField,
  Txt,
  haptics,
  showSnackbar,
  useDiscardGuard,
} from '@/ui';

import { localDate, moneyInputText, parseMoneyInput } from '../common';
import { fieldError, Hint, NotFoundScreen } from '../components/VerifyParts';
import { useSheetForm } from '../components/useSheetForm';
import { useReportSheet, verifyActions } from '../hooks';
import type { PickSource } from '../links';
import { EVICTION_OUTCOMES, SERVICE_URLS, type ReportForm, type Tri } from '../report';
import type { ReportSheet } from '../service';
import { chooseEvictions, pickMessage, reportView } from '../viewModels';

export default function ScreeningReportScreen() {
  const p = useLocalSearchParams<{ applicantId: string }>();
  const sheet = useReportSheet(Number(p.applicantId));
  if (!sheet) return <NotFoundScreen title={t('verify:s13.title')} />;
  return <ReportSheetView sheet={sheet} />;
}

const cents = (text: string) => {
  const c = parseMoneyInput(text);
  return c === null || Number.isNaN(c) ? null : c;
};

export function ReportSheetView({ sheet, now = new Date() }: { sheet: ReportSheet; now?: Date }) {
  const { colors } = useTheme();
  const { applicant } = sheet;
  const today = localDate(now);
  const { form, errors, dirty, edit, commit } = useSheetForm<ReportForm>(sheet.form, String(applicant.id), (f) => verifyActions.saveReport(applicant.id, f));
  const guard = useDiscardGuard(dirty);
  const [busy, setBusy] = useState<PickSource | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [fileToRemove, setFileToRemove] = useState<string | null>(null);
  const err = (f: string) => fieldError(errors, f);
  const view = reportView(sheet, form, today);

  /**
   * B-45: "Save" always answers. The keyboard is closed first (its pending text lands in the form before the save,
   * and the snackbar is not hidden behind it); a validation error or a failed write says so instead of doing nothing.
   */
  const save = () => {
    Keyboard.dismiss();
    let ok: boolean;
    try {
      ok = commit();
    } catch {
      haptics.error();
      showSnackbar({ message: t('verify:errors.saveFailed') });
      return;
    }
    if (ok) {
      haptics.success();
      showSnackbar({ message: t('verify:report.saved') });
    } else {
      showSnackbar({ message: t('verify:report.fixErrors') });
    }
  };

  const openService = async (s: keyof typeof SERVICE_URLS) => {
    edit({ service: s });
    if (!(await verifyActions.openUrl(SERVICE_URLS[s]))) showSnackbar({ message: t('verify:common.noBrowser') });
  };

  const attach = async (source: PickSource) => {
    setBusy(source);
    try {
      const res = await verifyActions.pick(source);
      const msg = pickMessage(source, res.status);
      if (msg) showSnackbar({ message: msg });
      if (res.status === 'picked' && res.files.length) {
        await verifyActions.attachReportFiles(applicant.id, res.files);
        haptics.success();
      }
    } catch {
      showSnackbar({ message: t('verify:report.attachFailed') });
    } finally {
      setBusy(null);
    }
  };

  const setCase = (i: number, patch: Partial<ReportForm['cases'][number]>) => edit({ cases: form.cases.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <Screen
      header={
        <AppBar
          title={t('verify:s13.title')}
          subtitle={view.subtitle}
          right={<TextButton label={t('common:actions.save')} onPress={save} />}
        />
      }
    >
      {guard}
      <Card variant="tint">
        <View style={styles.row}>
          <ShieldCheck size={20} color={colors.accent} />
          <Txt variant="callout" style={{ flex: 1 }}>{t('verify:report.explain')}</Txt>
        </View>
        <View style={styles.btnrow}>
          {(['mysmartmove', 'checkr', 'other'] as const).map((s) => (
            <Button key={s} label={t(`verify:report.open.${s}`)} icon={ExternalLink} variant="secondary" size="sm" onPress={() => openService(s)} />
          ))}
        </View>
        <Checkbox
          label={t('verify:report.service.applicant_copy')}
          value={form.service === 'applicant_copy'}
          onChange={(v) => edit({ service: v ? 'applicant_copy' : null })}
        />
      </Card>
      <GuideLink slug={GUIDE.screeningReports} />
      {view.showTooOld ? (
        <Banner tone="warn" icon={TriangleAlert}>
          {t('verify:report.tooOld')}
        </Banner>
      ) : null}

      <SectionHeader title={t('verify:report.companyTitle')} />
      <TextField
        label={t('verify:report.company.name')}
        value={form.companyName}
        help={t('verify:report.companyHelp')}
        onChangeText={(s) => edit({ companyName: s })}
        autoComplete="off"
      />
      <TextField label={t('verify:report.company.address')} value={form.companyAddress} multiline onChangeText={(s) => edit({ companyAddress: s })} autoComplete="off" />
      <TextField
        label={t('verify:report.company.phone')}
        value={form.companyPhone}
        keyboardType="phone-pad"
        onChangeText={(s) => edit({ companyPhone: s })}
        autoComplete="off"
      />
      {view.showCompanyMissing ? <Hint>{t('verify:report.companyMissing')}</Hint> : null}
      <DateField label={t('verify:report.reportDate')} value={form.reportDate} maximumDate={today} error={err('reportDate')} onChange={(d) => edit({ reportDate: d })} />

      <SectionHeader title={t('verify:report.results')} />
      <FieldShell label={t('verify:report.evictions')} error={err('evictionsMode')}>
        <Segmented
          options={[
            { value: 'none' as Tri, label: t('verify:report.noneFound') },
            { value: 'listed' as Tri, label: t('verify:report.casesListed') },
          ]}
          value={view.evictionsValue as Tri}
          onChange={(v) => edit(chooseEvictions(form, v === 'listed' ? 'listed' : 'none'))}
          accessibilityLabel={t('verify:report.evictions')}
        />
      </FieldShell>
      {view.showCases
        ? form.cases.map((c, i) => (
            <Card key={i}>
              <View style={styles.row}>
                <Txt variant="bodyStrong" style={{ flex: 1 }}>{t('verify:report.caseN', { n: i + 1 })}</Txt>
                <IconButton icon={Trash2} accessibilityLabel={t('verify:report.removeCase', { n: i + 1 })} onPress={() => edit({ cases: form.cases.filter((_, j) => j !== i) })} />
              </View>
              <TextField
                label={t('verify:report.caseDate')}
                help={t('verify:report.caseDateHelp')}
                value={c.date}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                error={err(`cases.${i}.date`)}
                onChangeText={(s) => setCase(i, { date: s })}
              />
              <FieldShell label={t('verify:report.caseOutcome')} error={err(`cases.${i}.outcome`)}>
                <ChoicePills
                  options={EVICTION_OUTCOMES.map((o) => ({ value: o, label: t(`verify:report.evictionOutcome.${o}`) }))}
                  value={c.outcome}
                  onChange={(o) => setCase(i, { outcome: o })}
                  accessibilityLabel={t('verify:report.caseOutcome')}
                />
              </FieldShell>
            </Card>
          ))
        : null}
      {view.showCases ? (
        <TextButton label={t('verify:report.addCase')} onPress={() => edit({ cases: [...form.cases, { date: '', outcome: null }] })} />
      ) : null}

      <FieldShell label={t('verify:report.collections')}>
        <Segmented
          options={[
            { value: 'none' as Tri, label: t('verify:report.none') },
            { value: 'listed' as Tri, label: t('verify:report.amount') },
          ]}
          value={view.collectionsValue as Tri}
          onChange={(v) => edit({ collectionsMode: v })}
          accessibilityLabel={t('verify:report.collections')}
        />
      </FieldShell>
      {view.showCollectionsAmount ? (
        <MoneyField
          label={t('verify:report.collectionsAmount')}
          required
          cents={cents(form.collectionsText)}
          error={err('collectionsText')}
          onChangeCents={(c) => edit({ collectionsText: moneyInputText(c) })}
        />
      ) : null}

      {view.showScoreBlock ? (
        <>
          <SectionHeader title={t('verify:report.creditTitle')} />
          <Checkbox label={t('verify:report.noScore')} value={form.noScore} onChange={(v) => edit({ noScore: v })} />
          {view.showScoreFields ? (
            <>
              <TextField label={t('verify:report.score')} value={form.scoreText} keyboardType="number-pad" maxLength={3} error={err('scoreText')} onChangeText={(s) => edit({ scoreText: s })} />
              <TextField label={t('verify:report.scoreModel')} value={form.scoreModel} error={err('scoreModel')} onChangeText={(s) => edit({ scoreModel: s })} />
              <TextField label={t('verify:report.scoreRange')} value={form.scoreRange} placeholder="300–850" error={err('scoreRange')} onChangeText={(s) => edit({ scoreRange: s })} />
              <DateField label={t('verify:report.scoreDate')} value={form.scoreDate} maximumDate={today} error={err('scoreDate')} onChange={(d) => edit({ scoreDate: d })} />
              <FieldShell label={t('verify:report.keyFactors')} help={t('verify:report.keyFactorsHelp')} error={err('keyFactors')}>
                {form.keyFactors.map((k, i) => (
                  <View key={i} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        label={t('verify:report.keyFactorN', { n: i + 1 })}
                        value={k}
                        onChangeText={(s) => edit({ keyFactors: form.keyFactors.map((x, j) => (j === i ? s : x)) })}
                      />
                    </View>
                    <IconButton icon={Trash2} accessibilityLabel={t('verify:report.removeKeyFactor', { n: i + 1 })} onPress={() => edit({ keyFactors: form.keyFactors.filter((_, j) => j !== i) })} />
                  </View>
                ))}
              </FieldShell>
              {view.canAddKeyFactor ? (
                <TextButton label={t('verify:report.addKeyFactor')} onPress={() => edit({ keyFactors: [...form.keyFactors, ''] })} />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <SectionHeader title={t('verify:report.filesTitle')} />
      {view.files.length ? (
        <ListGroup>
          {view.files.map((f) => (
            <ListRow
              key={f.path}
              icon={f.kind === 'pdf' ? FileText : ImageIcon}
              title={f.title}
              right={<IconButton icon={Trash2} accessibilityLabel={f.removeLabel} onPress={() => setFileToRemove(f.path)} />}
            />
          ))}
        </ListGroup>
      ) : (
        <Hint>{t('verify:report.noFiles')}</Hint>
      )}
      <View style={styles.btnrow}>
        <Button label={t('verify:report.addPdf')} icon={FolderOpen} variant="secondary" size="sm" loading={busy === 'files'} disabled={!!busy} onPress={() => attach('files')} />
        <Button label={t('verify:report.takePhoto')} icon={Camera} variant="secondary" size="sm" loading={busy === 'camera'} disabled={!!busy} onPress={() => attach('camera')} />
        <Button label={t('verify:report.choosePhotos')} icon={Plus} variant="secondary" size="sm" loading={busy === 'photos'} disabled={!!busy} onPress={() => attach('photos')} />
      </View>

      {view.showRemoveReport ? (
        <TextButton label={t('verify:report.remove')} tone="danger" onPress={() => setConfirmRemove(true)} />
      ) : null}

      <ConfirmDialog
        visible={confirmRemove}
        title={t('verify:report.removeTitle')}
        body={t('verify:report.removeBody')}
        confirmLabel={t('verify:report.remove')}
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          verifyActions.clearReport(applicant.id);
          router.back();
        }}
      />
      <ConfirmDialog
        visible={!!fileToRemove}
        title={t('verify:report.removeFileTitle')}
        confirmLabel={t('common:actions.delete')}
        destructive
        onCancel={() => setFileToRemove(null)}
        onConfirm={() => {
          if (fileToRemove) verifyActions.removeReportFile(applicant.id, fileToRemove);
          setFileToRemove(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnrow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
