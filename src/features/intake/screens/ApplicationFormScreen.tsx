/**
 * S-08 Application form (landlord + applicant mode) — product.md §5 S-08, mockup v2 "Application" / "Application
 * States" / "Applicant Mode". Routes (S-07 creates the draft first): /applicants/[id]/form?section= (landlord) · /applicants/mode/form/[id] (applicant mode: mode bar, no way out
 * without the landlord's lock).
 */
import { usePreventRemove, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { db, getApplicant } from '@/db';
import { files } from '@/files';
import { t } from '@/i18n';
import { parseId, routes, type FormSection } from '@/routes';
import {
  AppBar,
  Button,
  ButtonBar,
  Card,
  ConfirmDialog,
  DocThumb,
  EmptyState,
  FormProgress,
  haptics,
  Screen,
  showSnackbar,
  Txt,
} from '@/ui';

import { submitInApplicantMode } from '../applicantMode/actions';
import { canAccessApplicant } from '../applicantMode/guard';
import { dispatchApplicantMode, useApplicantMode } from '../applicantMode/store';
import { ApplicantModeBar } from '../components/LandlordLock';
import {
  AboutSection,
  ConsentSection,
  HouseholdSection,
  QuestionsSection,
  ResidencesSection,
  ReviewSection,
  WorkSection,
  type SectionProps,
} from '../components/FormSections';
import { usePickFile } from '../components/usePickFile';
import { clampSection, SECTION_KEYS, type FormMode } from '../form/model';
import { clearSignature, discardDraft } from '../form/service';
import { useApplicationForm } from '../hooks/useApplicationForm';
import { useIntakeRental, usePaperPhotos } from '../hooks/useIntakeData';
import { formFooter, formHeader, thumbLabel, tx } from '../screenModels';

const sectionTitle = (s: FormSection) => tx(`intake:sections.${SECTION_KEYS[s]}`);

export default function ApplicationFormScreen({ mode = 'landlord' }: { mode?: FormMode }) {
  const params = useLocalSearchParams<{ id?: string; section?: string }>();
  return (
    <View id="S-08" style={{ flex: 1 }}>
      <FormBody mode={mode} applicantId={parseId(params.id)} section={parseId(params.section)} />
    </View>
  );
}

function FormBody({ mode, applicantId, section }: { mode: FormMode; applicantId: number | null; section: number | null }) {
  const router = useRouter();
  const navigation = useNavigation();
  const [modeState] = useApplicantMode();
  const allowed = mode === 'landlord' || canAccessApplicant(modeState, applicantId);
  const rentalId = applicantId != null ? (getApplicant(db, applicantId)?.rentalId ?? null) : null;
  const rental = useIntakeRental(db, rentalId);
  const paperPhotos = usePaperPhotos(db, mode === 'landlord' ? applicantId : null);
  const picker = usePickFile();

  const f = useApplicationForm({
    db,
    files,
    applicantId: allowed ? applicantId : null,
    mode,
    initialStep: section != null ? clampSection(section) : null,
    submitFn: mode === 'applicant' ? (d, id, form) => submitInApplicantMode(d, id, form) : undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [askDiscard, setAskDiscard] = useState<null | (() => void)>(null);

  // Keep the applicant-mode machine on the same part (the guard routes by it).
  useEffect(() => {
    if (mode === 'applicant' && f.ready) dispatchApplicantMode({ type: 'GO', step: f.step });
  }, [mode, f.ready, f.step]);

  // Part 6: printed name defaults to the full legal name.
  useEffect(() => {
    if (f.step === 6 && f.form && !f.form.signedName.trim() && f.form.fullName.trim()) f.edit((x) => ({ ...x, signedName: x.fullName.trim() }));
  }, [f.step, f.form, f]);

  // Landlord, new application: leaving asks "Discard this application?" (an untouched draft just goes).
  const isNew = mode === 'landlord' && f.receivedEditable;
  usePreventRemove(isNew && !submitting, ({ data }) => {
    const leave = () => navigation.dispatch(data.action);
    if (applicantId != null && !f.form?.fullName.trim() && !f.dirty) {
      discardDraft(db, files.fileStore, applicantId);
      leave();
      return;
    }
    setAskDiscard(() => leave);
  });

  if (!allowed || f.notFound || (applicantId == null && mode === 'applicant'))
    return (
      <Screen topInset={mode !== 'applicant'} header={mode === 'applicant' ? <ApplicantModeBar /> : <AppBar back />}>
        <EmptyState icon={X} title={t('intake:s08.notFound')} />
      </Screen>
    );
  if (!f.ready || !f.form) return <Screen topInset={mode !== 'applicant'} header={mode === 'applicant' ? <ApplicantModeBar /> : <AppBar back />}>{null}</Screen>;

  const form = f.form;
  const footer = formFooter(f.step, mode);
  const header = formHeader({ isNew, save: f.save });
  const props: SectionProps = { form, errors: f.errors, warnings: f.warnings, update: f.update, edit: f.edit, mode };
  const customQuestions = rental?.customQuestions ?? [];

  const onPrimary = async () => {
    if (!footer.isLast) {
      const r = await f.next();
      if (!r.ok) haptics.error();
      return;
    }
    setSubmitting(true);
    const r = f.submit();
    if (!r || !r.ok) {
      setSubmitting(false);
      haptics.error();
      return;
    }
    haptics.success();
    if (mode === 'applicant') router.replace(routes.applicantModeDone(applicantId!));
    else {
      showSnackbar({ message: t('intake:s08.saved') });
      router.replace(routes.applicant(applicantId!));
    }
  };

  const paperCard =
    mode === 'landlord' && applicantId != null ? (
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Txt variant="bodyStrong">{t('intake:fields.paperForm')}</Txt>
        </View>
        <Txt variant="callout" color="inkMuted">
          {t('intake:fields.attachPaper')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {paperPhotos.map((p, i) => (
            <DocThumb key={p.id} label={thumbLabel(t('intake:fields.paperForm'), i, paperPhotos.length, false)} />
          ))}
          <DocThumb
            add
            label={t('intake:fields.attachPaper')}
            onPress={() => picker.open({ applicantId, type: 'paper_form', title: t('intake:fields.attachPaper') })}
          />
        </View>
        {picker.cameraBanner}
      </Card>
    ) : null;

  const body = (() => {
    switch (f.step) {
      case 1:
        return <AboutSection {...props} />;
      case 2:
        return <HouseholdSection {...props} />;
      case 3:
        return <ResidencesSection {...props} />;
      case 4:
        return <WorkSection {...props} />;
      case 5:
        return <QuestionsSection {...props} customQuestions={customQuestions} />;
      case 6:
        return (
          <ConsentSection
            {...props}
            onClearSaved={() => {
              clearSignature(db, files, applicantId!);
              f.update({ signaturePath: null, signedAt: null, pendingSignature: null });
            }}
          />
        );
      default:
        return (
          <ReviewSection
            {...props}
            customQuestions={customQuestions}
            goTo={f.goTo}
            receivedEditable={f.receivedEditable}
            firstCome={rental?.rental.reviewMode === 'first_come'}
            paperForm={paperCard}
          />
        );
    }
  })();

  const top =
    mode === 'applicant' ? (
      <ApplicantModeBar />
    ) : (
      <AppBar
        title={header.title}
        subtitle={header.subtitle}
        onBack={() => router.back()}
      />
    );

  return (
    <Screen
      topInset={mode !== 'applicant'}
      header={
        <View>
          {top}
          <View style={{ paddingHorizontal: 16, paddingTop: mode === 'applicant' ? 12 : 0, paddingBottom: 8 }}>
            <FormProgress current={f.step - 1} title={sectionTitle(f.step)} />
          </View>
        </View>
      }
      footer={
        <ButtonBar row>
          {footer.showBack ? <Button variant="secondary" label={t('common:actions.back')} onPress={f.step === 1 ? () => router.back() : f.back} /> : null}
          <Button label={footer.primaryLabel} onPress={() => void onPrimary()} loading={submitting} />
        </ButtonBar>
      }
    >
      {body}
      {picker.ui}
      <ConfirmDialog
        visible={askDiscard != null}
        title={t('intake:s08.discardTitle')}
        body={t('intake:s08.discardBody')}
        cancelLabel={t('common:actions.keepEditing')}
        confirmLabel={t('common:actions.discard')}
        destructive
        onCancel={() => setAskDiscard(null)}
        onConfirm={() => {
          const go = askDiscard;
          setAskDiscard(null);
          if (applicantId != null) discardDraft(db, files.fileStore, applicantId);
          go?.();
        }}
      />
    </Screen>
  );
}
