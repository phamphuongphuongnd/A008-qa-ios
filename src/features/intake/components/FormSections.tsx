/**
 * The 7 parts of S-08 (mockup v2 "Application" + "Application States"). Each part gets the form, the errors shown
 * after "Next" and `update` / `edit`. No SSN / birth date / sex / nationality field anywhere.
 */
import { Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { PetKind } from '@/engine';
import { formatDate } from '@/engine';
import { t } from '@/i18n';
import { font } from '@/theme';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  Chip,
  ChoicePills,
  DateField,
  KeyValue,
  MoneyField,
  Segmented,
  Sheet,
  SignaturePad,
  Stepper,
  TextButton,
  TextField,
  Txt,
} from '@/ui';

import {
  emptyResidence,
  MAX_OCCUPANTS,
  MAX_PETS_PER_KIND,
  newKey,
  OTHER_INCOME_KINDS,
  QUESTION_KEYS,
  type ApplicationForm,
  type FormMode,
  type FormSection,
  type OtherIncomeKind,
  type ResidenceDraft,
} from '../form/model';
import type { FieldError, WarningCode } from '../form/validate';
import { validateResidence } from '../form/validate';
import type { CustomQuestion } from '../rental';
import { errorText, incomeKindLabel, petPillLabel, residenceSummary, residenceTypeLabel, reviewSections, tx } from '../screenModels';
import { hasInk, padToSignature } from '../signature';
import { localDate } from '../time';
import { MonthField, ReceivedField, YesNo } from './Inputs';

export interface SectionProps {
  form: ApplicationForm;
  errors: FieldError[];
  warnings: WarningCode[];
  update: (patch: Partial<ApplicationForm>) => void;
  edit: (fn: (f: ApplicationForm) => ApplicationForm) => void;
  mode: FormMode;
}

const H = ({ title, hint }: { title: string; hint?: string }) => (
  <View style={{ gap: 4 }}>
    <Txt variant="title2" accessibilityRole="header">
      {title}
    </Txt>
    {hint ? (
      <Txt variant="body" color="inkMuted">
        {hint}
      </Txt>
    ) : null}
  </View>
);

// ---------------------------------------------------------------- 1. About you

export function AboutSection({ form, errors, update }: SectionProps) {
  const e = (f: string) => errorText(errors, f);
  return (
    <>
      <H title={t('intake:sections.about')} />
      <TextField
        label={t('intake:fields.fullName')}
        required
        value={form.fullName}
        onChangeText={(v) => update({ fullName: v })}
        autoComplete="name"
        textContentType="name"
        error={e('fullName')}
      />
      <TextField
        label={t('intake:fields.phone')}
        value={form.phone}
        onChangeText={(v) => update({ phone: v })}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="(614) 555-0142"
        error={e('phone')}
      />
      <TextField
        label={t('intake:fields.email')}
        value={form.email}
        onChangeText={(v) => update({ email: v })}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="name@example.com"
        error={e('email')}
      />
      <Txt variant="bodyStrong">{t('intake:fields.emergency')}</Txt>
      <TextField label={t('intake:fields.emergencyName')} value={form.emergencyName} onChangeText={(v) => update({ emergencyName: v })} placeholder={t('intake:fields.emergencyName')} />
      <TextField
        label={t('intake:fields.emergencyPhone')}
        value={form.emergencyPhone}
        onChangeText={(v) => update({ emergencyPhone: v })}
        keyboardType="phone-pad"
        placeholder={t('intake:fields.emergencyPhone')}
        error={e('emergencyPhone')}
      />
    </>
  );
}

// ---------------------------------------------------------------- 2. Household

const PET_KINDS: readonly PetKind[] = ['cat', 'dog', 'other'];

export function HouseholdSection({ form, errors, update, edit }: SectionProps) {
  const e = (f: string) => errorText(errors, f);
  const occ = form.occupants ?? 1;
  const selected = PET_KINDS.filter((k) => form.pets[k] > 0);
  return (
    <>
      <H title={t('intake:sections.household')} />
      <View style={{ gap: 8 }}>
        <Txt variant="bodyStrong">{t('intake:fields.occupants')}</Txt>
        <View style={{ alignSelf: 'flex-start' }}>
          <Stepper
            display={String(occ)}
            accessibilityLabel={t('intake:fields.occupants')}
            canDecrement={occ > 1}
            canIncrement={occ < MAX_OCCUPANTS}
            onDecrement={() => update({ occupants: Math.max(1, occ - 1) })}
            onIncrement={() => update({ occupants: Math.min(MAX_OCCUPANTS, occ + 1) })}
          />
        </View>
        {e('occupants') ? <Txt color="danger">{e('occupants')}</Txt> : null}
      </View>

      <View style={{ gap: 8 }}>
        <Txt variant="label">{t('intake:fields.otherAdults')}</Txt>
        {form.otherAdults.map((a, i) => (
          <View key={a.key} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <TextField
              style={{ flex: 1 }}
              label={`${t('intake:fields.otherAdults')} ${i + 1}`}
              value={a.name}
              onChangeText={(v) => edit((f) => ({ ...f, otherAdults: f.otherAdults.map((x) => (x.key === a.key ? { ...x, name: v } : x)) }))}
              error={e(`otherAdults.${i}.name`)}
            />
            <TextButton
              tone="danger"
              label={t('common:actions.delete')}
              onPress={() => edit((f) => ({ ...f, otherAdults: f.otherAdults.filter((x) => x.key !== a.key) }))}
            />
          </View>
        ))}
        {e('otherAdults') ? <Txt color="danger">{e('otherAdults')}</Txt> : null}
        <Button
          variant="secondary"
          size="sm"
          icon={Plus}
          label={t('intake:fields.addAdult')}
          onPress={() => edit((f) => ({ ...f, otherAdults: [...f.otherAdults, { key: newKey('a'), name: '', monthlyCents: null }] }))}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Txt variant="bodyStrong">{t('intake:fields.pets')}</Txt>
        <ChoicePills
          accessibilityLabel={t('intake:fields.pets')}
          options={PET_KINDS.map((k) => ({ value: k, label: petPillLabel(k, form.pets[k]) }))}
          values={selected}
          onToggle={(k, on) => edit((f) => ({ ...f, petsAnswered: true, pets: { ...f.pets, [k]: on ? Math.max(1, f.pets[k]) : 0 } }))}
        />
        {selected.map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Txt>{tx(`intake:petKind.${k}`)}</Txt>
            <Stepper
              display={String(form.pets[k])}
              accessibilityLabel={tx(`intake:petKind.${k}`)}
              canIncrement={form.pets[k] < MAX_PETS_PER_KIND}
              onDecrement={() => edit((f) => ({ ...f, pets: { ...f.pets, [k]: Math.max(0, f.pets[k] - 1) } }))}
              onIncrement={() => edit((f) => ({ ...f, pets: { ...f.pets, [k]: Math.min(MAX_PETS_PER_KIND, f.pets[k] + 1) } }))}
            />
          </View>
        ))}
        <Txt variant="caption" color="inkMuted">
          {t('intake:fields.petsNote')}
        </Txt>
      </View>

      <DateField
        label={t('intake:fields.moveInOn')}
        value={form.moveInOn}
        onChange={(d) => update({ moveInOn: d })}
        minimumDate={localDate()}
        error={e('moveInOn')}
      />

      <View style={{ gap: 8 }}>
        <Txt variant="bodyStrong">{t('intake:fields.voucher')}</Txt>
        <Segmented
          accessibilityLabel={t('intake:fields.voucher')}
          options={[
            { value: 'no', label: t('intake:yesNo.no') },
            { value: 'yes', label: t('intake:yesNo.yes') },
          ]}
          value={form.hasVoucher ? 'yes' : 'no'}
          onChange={(v) => update({ hasVoucher: v === 'yes' })}
        />
      </View>
      {form.hasVoucher ? (
        <>
          <MoneyField label={t('intake:fields.voucherAmount')} cents={form.voucherCents} onChangeCents={(c) => update({ voucherCents: c })} error={e('voucherCents')} />
          <TextField label={t('intake:fields.voucherProgram')} value={form.voucherProgram} onChangeText={(v) => update({ voucherProgram: v })} />
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- 3. Where you've lived

const RES_TYPES = ['rent', 'own', 'with_family', 'other'] as const;

function ResidenceEditor({ initial, onSave, onClose, onDelete }: { initial: ResidenceDraft; onSave: (r: ResidenceDraft) => void; onClose: () => void; onDelete?: () => void }) {
  const [r, setR] = useState(initial);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const set = (p: Partial<ResidenceDraft>) => setR((x) => ({ ...x, ...p }));
  const e = (f: string) => errorText(errors, f);
  const dirty = JSON.stringify(r) !== JSON.stringify(initial);
  return (
    <Sheet
      visible
      dirty={dirty}
      onClose={onClose}
      title={t('intake:fields.address')}
      footer={
        <View style={{ gap: 8 }}>
          <Button
            block
            label={t('common:actions.save')}
            onPress={() => {
              const errs = validateResidence(r);
              setErrors(errs);
              if (!errs.length) onSave(r);
            }}
          />
          {onDelete ? <Button block variant="dangerOutline" icon={Trash2} label={t('common:actions.delete')} onPress={onDelete} /> : null}
        </View>
      }
    >
      <TextField label={t('intake:fields.address')} required value={r.address} onChangeText={(v) => set({ address: v })} autoComplete="street-address" error={e('address')} />
      <MonthField label={t('intake:fields.from')} value={r.fromMonth} onChange={(v) => set({ fromMonth: v })} error={e('fromMonth')} />
      <MonthField label={t('intake:fields.to')} value={r.current ? null : r.toMonth} onChange={(v) => set({ toMonth: v })} disabled={r.current} error={e('toMonth')} />
      <Checkbox label={t('intake:fields.current')} value={r.current} onChange={(v) => set({ current: v, toMonth: v ? null : r.toMonth })} />
      <View style={{ gap: 8 }}>
        <Txt variant="label">{t('intake:fields.residenceType')}</Txt>
        <ChoicePills
          accessibilityLabel={t('intake:fields.residenceType')}
          options={RES_TYPES.map((v) => ({ value: v, label: tx(`intake:residenceType.${v}`) }))}
          value={r.type}
          onChange={(v) => set({ type: v })}
        />
        {e('type') ? <Txt color="danger">{e('type')}</Txt> : null}
      </View>
      <MoneyField label={t('intake:fields.rent')} cents={r.rentCents} onChangeCents={(c) => set({ rentCents: c })} error={e('rentCents')} />
      <TextField label={t('intake:fields.landlordName')} value={r.landlordName} onChangeText={(v) => set({ landlordName: v })} />
      <TextField label={t('intake:fields.landlordPhone')} value={r.landlordPhone} onChangeText={(v) => set({ landlordPhone: v })} keyboardType="phone-pad" error={e('landlordPhone')} />
      <TextField
        label={t('intake:fields.landlordEmail')}
        value={r.landlordEmail}
        onChangeText={(v) => set({ landlordEmail: v })}
        keyboardType="email-address"
        autoCapitalize="none"
        error={e('landlordEmail')}
      />
      <TextField label={t('intake:fields.reason')} value={r.reason} onChangeText={(v) => set({ reason: v })} multiline />
    </Sheet>
  );
}

export function ResidencesSection({ form, errors, warnings, edit }: SectionProps) {
  const [editing, setEditing] = useState<ResidenceDraft | null>(null);
  const isNew = editing != null && !form.residences.some((r) => r.key === editing.key);
  return (
    <>
      <H title={t('intake:sections.residences')} hint={t('intake:fields.residencesHint')} />
      {form.residences.map((r, i) => {
        const hasError = errors.some((x) => x.field.startsWith(`residences.${i}.`));
        return (
          <Card key={r.key} onPress={() => setEditing(r)} accessibilityLabel={`${r.address}, ${residenceTypeLabel(r)}, ${residenceSummary(r)}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <Txt variant="bodyStrong" style={{ flexShrink: 1 }}>
                {r.address || '—'}
              </Txt>
              {r.type ? <Chip size="sm" label={residenceTypeLabel(r)} /> : null}
            </View>
            <Txt variant="callout" color="inkMuted" tabular>
              {residenceSummary(r)}
            </Txt>
            {hasError ? <Txt color="danger">{errorText(errors, errors.find((x) => x.field.startsWith(`residences.${i}.`))!.field)}</Txt> : null}
          </Card>
        );
      })}
      {warnings.includes('coverShortOfThreeYears') ? <Banner tone="warn">{t('intake:warnings.coverShortOfThreeYears')}</Banner> : null}
      <Button variant="secondary" block icon={Plus} label={t('intake:fields.addAddress')} onPress={() => setEditing(emptyResidence())} />
      {editing ? (
        <ResidenceEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={isNew ? undefined : () => {
            edit((f) => ({ ...f, residences: f.residences.filter((x) => x.key !== editing.key) }));
            setEditing(null);
          }}
          onSave={(r) => {
            edit((f) => ({ ...f, residences: isNew ? [...f.residences, r] : f.residences.map((x) => (x.key === r.key ? r : x)) }));
            setEditing(null);
          }}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- 4. Work & income

export function WorkSection({ form, errors, update, edit }: SectionProps) {
  const e = (f: string) => errorText(errors, f);
  return (
    <>
      <H title={t('intake:sections.work')} />
      <TextField label={t('intake:fields.employer')} value={form.employer} onChangeText={(v) => update({ employer: v })} />
      <TextField label={t('intake:fields.jobTitle')} value={form.jobTitle} onChangeText={(v) => update({ jobTitle: v })} />
      <MonthField label={t('intake:fields.startDate')} value={form.startMonth} onChange={(v) => update({ startMonth: v })} error={e('startMonth')} />
      <MoneyField label={t('intake:fields.grossMonthly')} cents={form.monthlyCents} onChangeCents={(c) => update({ monthlyCents: c })} help={t('intake:fields.grossNote')} error={e('monthlyCents')} />
      <TextField label={t('intake:fields.employerPhone')} value={form.employerPhone} onChangeText={(v) => update({ employerPhone: v })} keyboardType="phone-pad" />
      <TextField label={t('intake:fields.supervisor')} value={form.supervisor} onChangeText={(v) => update({ supervisor: v })} />

      <Txt variant="bodyStrong">{t('intake:fields.otherIncome')}</Txt>
      {form.otherIncome.map((o, i) => (
        <Card key={o.key}>
          <ChoicePills
            accessibilityLabel={t('intake:fields.otherIncome')}
            options={OTHER_INCOME_KINDS.map((k) => ({ value: k, label: incomeKindLabel(k) }))}
            value={o.kind}
            onChange={(k: OtherIncomeKind) => edit((f) => ({ ...f, otherIncome: f.otherIncome.map((x) => (x.key === o.key ? { ...x, kind: k } : x)) }))}
          />
          <MoneyField
            label={incomeKindLabel(o.kind)}
            cents={o.monthlyCents}
            onChangeCents={(c) => edit((f) => ({ ...f, otherIncome: f.otherIncome.map((x) => (x.key === o.key ? { ...x, monthlyCents: c } : x)) }))}
            error={e(`otherIncome.${i}.monthlyCents`)}
          />
          <TextButton tone="danger" label={t('common:actions.delete')} onPress={() => edit((f) => ({ ...f, otherIncome: f.otherIncome.filter((x) => x.key !== o.key) }))} />
        </Card>
      ))}
      <Button
        variant="secondary"
        block
        icon={Plus}
        label={t('intake:fields.addOtherIncome')}
        onPress={() => edit((f) => ({ ...f, otherIncome: [...f.otherIncome, { key: newKey('o'), kind: 'benefits', monthlyCents: null }] }))}
      />

      {form.otherAdults.length ? (
        <>
          <Txt variant="bodyStrong">{t('intake:fields.adultIncome')}</Txt>
          {form.otherAdults.map((a, i) => (
            <MoneyField
              key={a.key}
              label={a.name || `${t('intake:fields.otherAdults')} ${i + 1}`}
              cents={a.monthlyCents}
              onChangeCents={(c) => edit((f) => ({ ...f, otherAdults: f.otherAdults.map((x) => (x.key === a.key ? { ...x, monthlyCents: c } : x)) }))}
              error={e(`otherAdults.${i}.monthlyCents`)}
            />
          ))}
        </>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------- 5. A few questions

export function QuestionsSection({ form, update, edit, customQuestions }: SectionProps & { customQuestions: CustomQuestion[] }) {
  return (
    <>
      <H title={t('intake:sections.questions')} />
      {QUESTION_KEYS.map((k) => (
        <View key={k} style={{ gap: 8 }}>
          <YesNo
            label={tx(`intake:questions.${k}`)}
            value={form.answers[k] == null ? null : form.answers[k] === 'yes'}
            onChange={(v) => update({ answers: { ...form.answers, [k]: v ? 'yes' : 'no' } })}
          />
          {form.answers[k] === 'yes' ? (
            <TextField label={t('intake:fields.explain')} value={form.explain[k]} multiline onChangeText={(v) => update({ explain: { ...form.explain, [k]: v } })} />
          ) : null}
        </View>
      ))}
      {customQuestions.map((q) => (
        <YesNo key={q.id} label={q.title} value={form.customAnswers[q.id] ?? null} onChange={(v) => edit((f) => ({ ...f, customAnswers: { ...f.customAnswers, [q.id]: v } }))} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------- 6. Consent & signature

export function ConsentSection({ form, errors, update, onClearSaved }: SectionProps & { onClearSaved: () => void }) {
  const e = (f: string) => errorText(errors, f);
  const [typed, setTyped] = useState(form.pendingSignature?.kind === 'typed');
  const saved = form.signaturePath && !form.pendingSignature;
  return (
    <>
      <H title={t('intake:sections.consent')} />
      <Checkbox label={t('intake:fields.authorize')} value={form.consent.authorize} onChange={(v) => update({ consent: { ...form.consent, authorize: v } })} />
      {e('consent.authorize') ? <Txt color="danger">{e('consent.authorize')}</Txt> : null}
      <Checkbox label={t('intake:fields.certify')} value={form.consent.certify} onChange={(v) => update({ consent: { ...form.consent, certify: v } })} />
      {e('consent.certify') ? <Txt color="danger">{e('consent.certify')}</Txt> : null}

      {saved ? (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Chip
              tone="accent"
              dot
              label={form.signedAt ? `${t('ui:signature.signed')} · ${formatDate(form.signedAt.slice(0, 10))}` : t('ui:signature.signed')}
            />
            <TextButton label={t('intake:fields.clear')} onPress={onClearSaved} />
          </View>
        </Card>
      ) : typed ? (
        <TextField
          label={t('intake:fields.signature')}
          value={form.pendingSignature?.kind === 'typed' ? form.pendingSignature.name : ''}
          onChangeText={(v) => update({ pendingSignature: v ? { kind: 'typed', name: v } : null })}
          autoComplete="name"
          error={e('signature')}
        />
      ) : (
        <View style={{ gap: 6 }}>
          <SignaturePad label={t('intake:fields.signature')} onChange={(v) => update({ pendingSignature: padToSignature(v) })} />
          {e('signature') ? <Txt color="danger">{e('signature')}</Txt> : null}
        </View>
      )}
      {!saved ? (
        <TextButton
          label={typed ? t('intake:fields.drawInstead') : t('intake:fields.typeInstead')}
          onPress={() => {
            setTyped(!typed);
            if (hasInk(form.pendingSignature)) update({ pendingSignature: null });
          }}
        />
      ) : null}
      <TextField label={t('intake:fields.printedName')} value={form.signedName} onChangeText={(v) => update({ signedName: v })} autoComplete="name" error={e('signedName')} />
      <KeyValue label={t('intake:fields.date')} value={formatDate(localDate())} />
    </>
  );
}

// ---------------------------------------------------------------- 7. Review

export function ReviewSection({
  form,
  errors,
  warnings,
  update,
  mode,
  customQuestions,
  goTo,
  receivedEditable,
  firstCome,
  paperForm,
}: SectionProps & {
  customQuestions: CustomQuestion[];
  goTo: (s: FormSection) => void;
  receivedEditable: boolean;
  firstCome: boolean;
  /** Landlord: the "Paper form" card (thumbnails + Add). */
  paperForm?: React.ReactNode;
}) {
  const sections = reviewSections(form, customQuestions).filter((s) => mode === 'applicant' || s.step !== 6 || s.rows.length);
  return (
    <>
      <H title={t('intake:sections.review')} />
      {sections.map((s) => (
        <Card key={s.step}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <Txt variant="bodyStrong" accessibilityRole="header" style={{ flexShrink: 1 }}>
              {s.title}
            </Txt>
            <TextButton label={t('common:actions.edit')} accessibilityLabel={`${t('common:actions.edit')} ${s.title}`} onPress={() => goTo(s.step)} />
          </View>
          {s.rows.map((r, i) => (
            <ReviewRow key={i} label={r.label} value={r.value} />
          ))}
          {s.step === 3 && warnings.includes('coverShortOfThreeYears') ? (
            <Txt variant="callout" color="warn">
              {t('intake:warnings.coverShortOfThreeYears')}
            </Txt>
          ) : null}
        </Card>
      ))}
      {mode === 'landlord' ? (
        <>
          {paperForm}
          <ReceivedField
            value={form.receivedAt}
            onChange={(ts) => update({ receivedAt: ts })}
            editable={receivedEditable}
            error={errorText(errors, 'receivedAt')}
            help={t('intake:fields.receivedHint')}
          />
          {firstCome && receivedEditable ? <Banner tone="warn">{t('intake:warnings.firstComeReceived')}</Banner> : null}
        </>
      ) : null}
    </>
  );
}

/**
 * Review row: the question takes the free width and wraps; the answer keeps its own width (up to half the row), so a
 * short answer like "No" never breaks into "N/o" at 320 dp / 200 % text next to a long question (B-74a).
 */
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }} accessible accessibilityLabel={`${label}: ${value}`}>
      <Txt color="inkMuted" style={[font(400, 14, 20), { flex: 1 }]}>
        {label}
      </Txt>
      <Txt tabular style={[font(500, 14, 20), { textAlign: 'right', flexShrink: 0, maxWidth: '50%' }]}>
        {value}
      </Txt>
    </View>
  );
}
