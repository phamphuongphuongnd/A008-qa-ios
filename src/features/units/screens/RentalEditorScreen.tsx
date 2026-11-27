/** S-03 Rental editor — product.md §5 S-03, mockup v2 "Rental editor" (create: step 1 of 3; edit: Save). */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { parseId, routes } from '@/routes';
import { t } from '@/i18n';
import { GUIDE } from '@/features/guide/articles';
import { GuideLink } from '@/features/guide/components/GuideLink';
import {
  AppBar,
  Banner,
  Button,
  ButtonBar,
  ConfirmDialog,
  DateField,
  EmptyState,
  FieldShell,
  FormProgress,
  MoneyField,
  Screen,
  Segmented,
  TextField,
  Txt,
  formCellBasis,
  haptics,
  showSnackbar,
  useDiscardGuard,
} from '@/ui';
import { FileQuestion } from 'lucide-react-native';

import { SelectField } from '../components/SelectField';
import { useRentalActions, useRentalForm } from '../hooks';
import {
  firstErrorField,
  isRentalFormDirty,
  rentalModeHint,
  validateRental,
  type RentalField,
  type RentalForm,
} from '../rentalForm';
import type { ModeChangePlan } from '../rentalService';
import {
  BATHROOM_OPTIONS,
  BEDROOM_OPTIONS,
  STATE_OPTIONS,
  editorTexts,
  rentalErrorMessages,
} from '../screenModels';

export default function RentalEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const rentalId = id === undefined ? null : parseId(id);
  const initial = useRentalForm(id === undefined ? null : (rentalId ?? -1));
  if (!initial) {
    return (
      <Screen header={<AppBar title={t('units:s03.titleEdit')} />}>
        <EmptyState icon={FileQuestion} title={t('units:s06.notFound')} />
      </Screen>
    );
  }
  return <Editor key={rentalId ?? 'new'} rentalId={rentalId} initial={initial} />;
}

function Editor({ rentalId, initial }: { rentalId: number | null; initial: RentalForm }) {
  const isNew = rentalId === null;
  const texts = editorTexts(isNew);
  const actions = useRentalActions();
  const [form, setForm] = useState<RentalForm>(initial);
  const [touched, setTouched] = useState<Partial<Record<RentalField, boolean>>>({});
  const [showAll, setShowAll] = useState(false);
  const [confirm, setConfirm] = useState<ModeChangePlan | null>(null);
  const [leaveTo, setLeaveTo] = useState<null | (() => void)>(null);
  const streetRef = useRef<ComponentRef<typeof TextInput>>(null);
  const zipRef = useRef<ComponentRef<typeof TextInput>>(null);

  const dirty = isRentalFormDirty(initial, form) && !leaveTo;
  const guard = useDiscardGuard(dirty);
  useEffect(() => {
    if (leaveTo) leaveTo();
  }, [leaveTo]);

  const errors = validateRental(form);
  const messages = rentalErrorMessages(errors);
  const errorOf = (f: RentalField) => (showAll || touched[f] ? (messages[f] ?? null) : null);
  const set = <K extends RentalField>(k: K, v: RentalForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const blur = (f: RentalField) => () => setTouched((x) => ({ ...x, [f]: true }));
  const hint = rentalModeHint(form);
  // B-81: cells ask for more width as the text grows, so State / ZIP stack instead of breaking words at AX-XL / 200 %.
  const { fontScale } = useWindowDimensions();
  const cell = [styles.cell, { flexBasis: formCellBasis(fontScale) }];

  const save = (confirmModeChange = false) => {
    if (firstErrorField(validateRental(form))) {
      setShowAll(true);
      haptics.error();
      const first = firstErrorField(validateRental(form));
      if (first === 'street') streetRef.current?.focus();
      else if (first === 'zip') zipRef.current?.focus();
      return;
    }
    if (isNew) {
      const r = actions.create(form);
      if (!r.ok) return setShowAll(true);
      haptics.success();
      setLeaveTo(() => () => router.replace(routes.criteria(r.id, { setup: true })));
      return;
    }
    const r = actions.update(rentalId as number, form, confirmModeChange);
    if (!r.ok) {
      if ('confirm' in r) setConfirm(r.confirm);
      else setShowAll(true);
      return;
    }
    haptics.success();
    showSnackbar({ message: t('units:s03.saved') });
    setLeaveTo(() => () => router.back());
  };

  return (
    <Screen
      header={
        <>
          {/* Step text comes with FormProgress ("Step 1 of 3"). */}
          <AppBar title={texts.title} />
          {isNew ? (
            <View style={styles.progress}>
              <FormProgress current={0} total={3} />
            </View>
          ) : null}
        </>
      }
      footer={
        <ButtonBar>
          <Button block label={texts.button} onPress={() => save()} />
        </ButtonBar>
      }
    >
      <TextField
        ref={streetRef}
        label={t('units:s03.fields.street')}
        required
        value={form.street}
        onChangeText={(v) => set('street', v)}
        onBlur={blur('street')}
        error={errorOf('street')}
        autoComplete="street-address"
        textContentType="streetAddressLine1"
        maxLength={120}
      />
      <View style={styles.grid}>
        <TextField
          style={cell}
          label={t('units:s03.fields.unit')}
          value={form.unit}
          onChangeText={(v) => set('unit', v)}
          onBlur={blur('unit')}
          error={errorOf('unit')}
          maxLength={120}
        />
        <TextField
          style={cell}
          label={t('units:s03.fields.city')}
          value={form.city}
          onChangeText={(v) => set('city', v)}
          onBlur={blur('city')}
          error={errorOf('city')}
          textContentType="addressCity"
          maxLength={120}
        />
      </View>
      <View style={styles.grid}>
        <View style={cell}>
          <SelectField
            label={t('units:s03.fields.state')}
            value={form.state}
            options={STATE_OPTIONS}
            onChange={(v) => set('state', v)}
            placeholder={t('units:s03.fields.statePlaceholder')}
            error={errorOf('state')}
          />
        </View>
        <TextField
          ref={zipRef}
          style={cell}
          label={t('units:s03.fields.zip')}
          value={form.zip}
          onChangeText={(v) => set('zip', v.replace(/[^0-9]/g, '').slice(0, 5))}
          onBlur={blur('zip')}
          error={errorOf('zip')}
          keyboardType="number-pad"
          textContentType="postalCode"
          maxLength={5}
        />
      </View>
      <View style={styles.grid}>
        <MoneyField
          style={cell}
          label={t('units:s03.fields.rent')}
          required
          cents={form.rentCents}
          onChangeCents={(v) => set('rentCents', v)}
          onBlur={blur('rentCents')}
          error={errorOf('rentCents')}
        />
        <View style={cell}>
          <SelectField
            label={t('units:s03.fields.bedrooms')}
            value={form.bedrooms}
            options={BEDROOM_OPTIONS}
            onChange={(v) => set('bedrooms', v)}
            error={errorOf('bedrooms')}
          />
        </View>
      </View>
      <View style={styles.grid}>
        <View style={cell}>
          <SelectField
            label={t('units:s03.fields.bathrooms')}
            value={form.bathrooms}
            options={BATHROOM_OPTIONS}
            onChange={(v) => set('bathrooms', v)}
            error={errorOf('bathrooms')}
          />
        </View>
        <DateField
          style={cell}
          label={t('units:s03.fields.availableOn')}
          value={form.availableOn}
          onChange={(v) => set('availableOn', v)}
          error={errorOf('availableOn')}
        />
      </View>
      <View style={styles.grid}>
        <MoneyField
          style={cell}
          label={t('units:s03.fields.deposit')}
          cents={form.depositCents}
          onChangeCents={(v) => set('depositCents', v)}
          onBlur={blur('depositCents')}
          error={errorOf('depositCents')}
        />
        <MoneyField
          style={cell}
          label={t('units:s03.fields.fee')}
          help={t('units:s03.fields.feeNote')}
          cents={form.feeCents}
          onChangeCents={(v) => set('feeCents', v)}
          onBlur={blur('feeCents')}
          error={errorOf('feeCents')}
        />
      </View>

      <FieldShell label={t('units:s03.reviewMode')}>
        <Segmented
          options={[
            { value: 'compare', label: t('units:mode.compareOption') },
            { value: 'first_come', label: t('units:mode.firstComeOption') },
          ]}
          value={form.reviewMode}
          onChange={(v) => set('reviewMode', v)}
          accessibilityLabel={t('units:s03.reviewMode')}
        />
        {hint ? (
          <>
            <Banner tone="warn">{hint}</Banner>
            <GuideLink slug={GUIDE.firstCome} />
          </>
        ) : null}
        <Txt variant="caption" color="inkMuted">
          {t(form.reviewMode === 'compare' ? 'units:mode.compareHelp' : 'units:mode.firstComeHelp')}
        </Txt>
      </FieldShell>

      <TextField
        label={t('units:s03.fields.notes')}
        multiline
        value={form.notes}
        onChangeText={(v) => set('notes', v)}
        onBlur={blur('notes')}
        error={errorOf('notes')}
        maxLength={2000}
      />

      <ConfirmDialog
        visible={!!confirm}
        tone="warn"
        title={confirm?.title ?? ''}
        body={confirm?.message}
        confirmLabel={t('units:s03.modeChange.confirm')}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          save(true);
        }}
      />
      {guard}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { paddingHorizontal: 16, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexGrow: 1, flexBasis: 140 },
});
