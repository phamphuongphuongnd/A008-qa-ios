/** S-04 Criteria builder — product.md §5 S-04, §3.2, §3.12, §3.13; mockup v2 "Criteria" + "Guardrails". */
import { useLocalSearchParams } from 'expo-router';
import { FileQuestion, Plus } from 'lucide-react-native';
import { Children, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { MAX_CUSTOM_CRITERIA, WARNING_MESSAGES, formatUsd } from '@/engine';
import type { SmokingPolicy } from '@/db/schema';
import { t } from '@/i18n';
import { parseId, routes } from '@/routes';
import { router } from '@/services/router';
import { font, useTheme } from '@/theme';
import {
  AppBar,
  Banner,
  Button,
  ButtonBar,
  ChoicePills,
  ConfirmDialog,
  EmptyState,
  FormProgress,
  KeyValue,
  LegalFooter,
  ListGroup,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  TextButton,
  TextField,
  Txt,
  haptics,
  showSnackbar,
  useDiscardGuard,
} from '@/ui';
import { addressLine } from '@/features/units/format';

import { CriterionCard, GUIDE_SLUGS } from '../components/CriterionCard';
import { customAddError, customCount } from '../criteriaEditor';
import { useCriteriaEditor } from '../hooks';
import { criteriaFooter, criterionCards } from '../screenModels';

const SMOKING: SmokingPolicy[] = ['non_smoking', 'outside', 'allowed'];

export default function CriteriaBuilderScreen() {
  const { id, setup } = useLocalSearchParams<{ id: string; setup?: string }>();
  const rentalId = parseId(id) ?? -1;
  const isSetup = setup === '1';
  const ed = useCriteriaEditor(rentalId);
  const { colors } = useTheme();
  const { state, dispatch } = ed;

  const [smoking, setSmoking] = useState<SmokingPolicy | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [answeredBy, setAnsweredBy] = useState<'applicant' | 'landlord'>('applicant');
  const [previewSeq, setPreviewSeq] = useState(0);
  const handledSeq = useRef(0);
  const customRef = useRef<ComponentRef<typeof TextInput>>(null);

  const smokingValue = smoking ?? ed.rental?.smokingPolicy ?? 'non_smoking';
  const smokingDirty = !!ed.rental && smokingValue !== ed.rental.smokingPolicy;
  const anyDirty = ed.dirty || smokingDirty;
  const guard = useDiscardGuard(anyDirty);
  // "Preview" after a save: navigate once the saved version is on screen (nothing dirty, so no discard prompt).
  useEffect(() => {
    if (previewSeq > handledSeq.current && !anyDirty) {
      handledSeq.current = previewSeq;
      router.push(routes.publishedCriteria(rentalId, { setup: true }));
    }
  }, [previewSeq, anyDirty, rentalId]);

  if (ed.notFound || !ed.rental) {
    return (
      <Screen header={<AppBar title={t('units:s04.title')} />}>
        <EmptyState icon={FileQuestion} title={t('units:s06.notFound')} />
      </Screen>
    );
  }
  const rental = ed.rental;
  const cards = criterionCards(state, ed.errors, ed.warnings);
  const footer = criteriaFooter(state, isSetup, smokingDirty);
  const customErr = customTitle.trim() ? customAddError(state.draft, customTitle) : null;
  const atLimit = customCount(state.draft) >= MAX_CUSTOM_CRITERIA;
  const blocked = customErr?.code === 'prohibited';

  const save = (): boolean => {
    const r = ed.save({ smokingPolicy: smokingValue });
    if (!r.ok) {
      haptics.error();
      showSnackbar({ message: t('units:s04.invalid') });
      return false;
    }
    haptics.success();
    setSmoking(null);
    showSnackbar({ message: t(r.recorded ? 'units:s04.savedRecorded' : 'units:s04.saved') });
    return true;
  };
  const onFooter = () => {
    if (footer.action === 'preview') return router.push(routes.publishedCriteria(rentalId, { setup: isSetup }));
    if (!save()) return;
    if (footer.action === 'saveAndPreview') setPreviewSeq((n) => n + 1);
  };
  const closeCustom = () => {
    setCustomOpen(false);
    setCustomTitle('');
    setAnsweredBy('applicant');
  };

  return (
    <Screen
      header={
        <>
          <AppBar title={t('units:s04.title')} subtitle={addressLine(rental)} />
          {isSetup ? (
            <View style={styles.progress}>
              <FormProgress current={1} total={3} />
            </View>
          ) : null}
        </>
      }
      footer={
        <ButtonBar>
          <Button block label={footer.label} disabled={footer.disabled} onPress={onFooter} />
        </ButtonBar>
      }
    >
      {state.locked ? (
        <Banner
          tone="info"
          actions={state.phase === 'locked' ? [{ label: t('units:s04.editCriteria'), onPress: () => dispatch({ type: 'requestUnlock' }) }] : undefined}
        >
          {t('units:s04.lockedBanner')}
        </Banner>
      ) : (
        <View style={styles.intro}>
          <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{t('units:s04.intro')}</Txt>
          <TextButton label={t('units:s04.writingFair')} onPress={() => router.push(routes.guideArticle(GUIDE_SLUGS.fairCriteria))} />
        </View>
      )}

      <View style={{ opacity: ed.editable ? 1 : 0.6 }}>
        <ListGroup>
          {cards.map((c) => (
            <CriterionCard
              key={c.id}
              card={c}
              editable={ed.editable}
              dispatch={dispatch}
              onDismissWarning={(code) => dispatch({ type: 'dismissWarning', code })}
            />
          ))}
        </ListGroup>
      </View>

      {ed.editable ? (
        <Button
          block
          variant="secondary"
          icon={Plus}
          disabled={atLimit}
          label={atLimit ? t('units:s04.custom.limit', { max: MAX_CUSTOM_CRITERIA }) : t('units:s04.custom.add')}
          onPress={() => setCustomOpen(true)}
        />
      ) : null}

      <View>
        <SectionHeader title={t('units:s04.policies.title')} />
        <ListGroup>
          <View style={styles.policy}>
            <Txt variant="label">{t('units:s04.policies.smoking')}</Txt>
            {ed.editable ? (
              <ChoicePills<SmokingPolicy>
                options={SMOKING.map((v) => ({ value: v, label: t(`units:s04.smoking.${v}`) }))}
                value={smokingValue}
                onChange={setSmoking}
                accessibilityLabel={t('units:s04.policies.smoking')}
              />
            ) : (
              <Txt>{t(`units:s04.smoking.${smokingValue}`)}</Txt>
            )}
          </View>
          <View style={styles.policy}>
            <KeyValue label={t('units:s04.policies.deposit')} value={rental.depositCents ? formatUsd(rental.depositCents) : '—'} />
            <KeyValue label={t('units:s04.policies.fee')} value={formatUsd(rental.feeCents)} />
          </View>
        </ListGroup>
      </View>

      <LegalFooter />

      {/* Unlock sheet (§3.13) */}
      <Sheet
        visible={state.phase === 'unlocking'}
        onClose={() => dispatch({ type: 'cancelUnlock' })}
        title={t('units:s04.unlock.title')}
        dirty={!!state.reason.trim()}
        footer={
          <SheetButtons>
            <Button variant="secondary" block label={t('common:actions.cancel')} onPress={() => dispatch({ type: 'cancelUnlock' })} />
            <Button block label={t('units:s04.unlock.confirm')} disabled={!state.reason.trim()} onPress={() => dispatch({ type: 'confirmUnlock' })} />
          </SheetButtons>
        }
      >
        <Txt style={[font(400, 14, 20), { color: colors.inkMuted }]}>{t('units:s04.unlock.body')}</Txt>
        <TextField
          label={t('units:s04.unlock.placeholder')}
          multiline
          autoFocus
          value={state.reason}
          maxLength={500}
          onChangeText={(reason) => dispatch({ type: 'setReason', reason })}
        />
      </Sheet>

      {/* Custom yes/no criterion (§3.12 guardrail) */}
      <Sheet
        visible={customOpen}
        onClose={closeCustom}
        title={t('units:s04.custom.title')}
        dirty={!!customTitle.trim()}
        footer={
          // Mockup "Custom criterion blocked": Edit / Add share the row, then the legal line — no grey bar.
          <View style={styles.sheetFooter}>
            <SheetButtons>
              <Button
                variant="secondary"
                block
                label={blocked ? t('common:actions.edit') : t('common:actions.cancel')}
                onPress={() => (blocked ? customRef.current?.focus() : closeCustom())}
              />
              <Button
                block
                label={t('units:s04.custom.addAction')}
                disabled={!customTitle.trim() || !!customErr}
                onPress={() => {
                  dispatch({ type: 'addCustom', title: customTitle, answeredBy });
                  closeCustom();
                }}
              />
            </SheetButtons>
            <LegalFooter />
          </View>
        }
      >
        <TextField
          ref={customRef}
          label={t('units:s04.custom.question')}
          value={customTitle}
          maxLength={80}
          onChangeText={setCustomTitle}
          // A blocked word is a fair-housing warning (orange box below), not a typing error.
          error={blocked ? null : (customErr?.message ?? null)}
          state={blocked ? 'error' : undefined}
          accessibilityHint={blocked ? customErr?.message : undefined}
        />
        {blocked ? (
          <View accessibilityLiveRegion="polite">
            <Banner tone="warn">{customErr?.message}</Banner>
          </View>
        ) : null}
        <Txt variant="label">{t('units:s04.custom.whoAnswers')}</Txt>
        <Segmented
          options={[
            { value: 'applicant', label: t('units:s04.custom.applicant') },
            { value: 'landlord', label: t('units:s04.custom.landlord') },
          ]}
          value={answeredBy}
          onChange={setAnsweredBy}
          accessibilityLabel={t('units:s04.custom.whoAnswers')}
        />
      </Sheet>

      {/* Voucher option off (§3.12) */}
      <ConfirmDialog
        visible={!!state.pendingVoucher}
        tone="warn"
        title={t('units:s04.voucherDialog.title')}
        body={WARNING_MESSAGES.voucher_off}
        cancelLabel={t('units:s04.voucherDialog.keep')}
        confirmLabel={t('units:s04.voucherDialog.turnOff')}
        destructive
        onCancel={() => dispatch({ type: 'keepVoucherOn' })}
        onConfirm={() => dispatch({ type: 'confirmVoucherOff' })}
      />
      {guard}
    </Screen>
  );
}

/** Two equal buttons on one row inside a sheet (ButtonBar is the screen's bottom bar: own background, border, inset). */
function SheetButtons({ children }: { children: ReactNode }) {
  return <View style={styles.sheetButtons}>{Children.map(children, (c) => (c ? <View style={{ flex: 1 }}>{c}</View> : null))}</View>;
}

const styles = StyleSheet.create({
  sheetButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetFooter: { gap: 12 },
  progress: { paddingHorizontal: 16, paddingBottom: 8 },
  intro: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6 },
  policy: { paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
});
