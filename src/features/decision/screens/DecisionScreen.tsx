/**
 * S-15 Decision sheet (F-13) — product.md §5 S-15, mockup v2 "Decision". Options depend on the status (Conditional
 * offer only with C10; after an offer: Approve / Approve with conditions / Withdraw offer). Deny, conditions and
 * withdraw need reasons; the §3.15 box decides the FCRA notice. `?kind=` preselects (S-14 → withdraw_offer).
 * Approve stops a First-come 48 h offer clock (Phương 2026-11-26, no "Applicant accepted" button).
 * After saving with a required notice: "An adverse action notice is required" → Create notice (S-16).
 */
import { useLocalSearchParams } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import type { DecisionKind } from '@/engine';
import { t } from '@/i18n';
import { routes } from '@/routes';
import { router } from '@/services/router';
import {
  AppBar,
  Banner,
  Button,
  ButtonBar,
  Checkbox,
  ConfirmDialog,
  LegalFooter,
  MoneyField,
  OptionCard,
  Screen,
  SectionHeader,
  TextField,
  haptics,
  showSnackbar,
  useDiscardGuard,
} from '@/ui';

import { checkDecision, saveDecisionAction, type DecisionContext } from '../decision';
import { decisionDeps } from '../deps';
import { useDecisionContext } from '../hooks';
import {
  chooseKind,
  decisionFormView,
  decisionInputOf,
  initialDecisionForm,
  isDecisionDirty,
  parseDecisionKind,
  savedSummary,
  statusAfterLabel,
  toggleReason,
  type DecisionForm,
} from '../viewModel';
import { Hint, idParam, NotFoundScreen } from '../components/DecisionParts';

export default function DecisionScreen() {
  const p = useLocalSearchParams<{ id: string; kind?: string }>();
  const ctx = useDecisionContext(idParam(p.id));
  if (!ctx) return <NotFoundScreen title={t('decision:s15.title')} />;
  return <DecisionSheet ctx={ctx} preset={parseDecisionKind(p.kind)} />;
}

function DecisionSheet({ ctx, preset }: { ctx: DecisionContext; preset: DecisionKind | null }) {
  const id = ctx.review.bundle.applicant.id;
  const name = ctx.review.bundle.applicant.fullName;
  const [initial] = useState(() => initialDecisionForm(ctx, preset));
  const [form, setForm] = useState<DecisionForm>(initial);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ decisionId: number; summary: string } | null>(null);

  const input = decisionInputOf(ctx, form);
  const preview = input ? checkDecision(ctx, input) : null;
  const view = decisionFormView(ctx, form, preview);
  const guard = useDiscardGuard(isDecisionDirty(initial, form) && !saving && !notice);

  // After a save the status is closed (no options): keep the sheet (and its notice dialog) until it leaves.
  if (!ctx.options.length && !saving) return <NotFoundScreen title={t('decision:s15.title')} message={t('decision:s15.notAvailable')} />;

  const save = async () => {
    if (!input) return;
    if (view.errors > 0) {
      setTried(true);
      haptics.error();
      return;
    }
    setSaving(true);
    const r = await saveDecisionAction(decisionDeps, id, input);
    if (!r.ok) {
      setSaving(false);
      setTried(true);
      haptics.error();
      showSnackbar({ message: r.message });
      return;
    }
    haptics.success();
    if (r.notice.adverseAction) {
      setNotice({ decisionId: r.decisionId, summary: savedSummary(input.kind, r.at) });
      return;
    }
    showSnackbar({ message: t('decision:s15.saved', { status: statusAfterLabel(input.kind) }) });
    router.back();
  };

  return (
    <Screen
      header={<AppBar title={t('decision:s15.title')} subtitle={name} />}
      footer={
        <ButtonBar hint={tried && view.errors > 0 ? t('decision:s15.fixErrors', { count: view.errors }) : (view.noticeHint ?? undefined)}>
          <Button label={t('decision:s15.save')} block disabled={!view.canPress} loading={saving} onPress={save} />
        </ButtonBar>
      }
    >
      {guard}
      <View style={{ gap: 8 }}>
        <SectionHeader title={t('decision:s15.chooseKind')} />
        {view.options.map((o) => (
          <OptionCard
            key={o.kind}
            kind="radio"
            title={o.title}
            description={o.description}
            selected={o.selected}
            onPress={() => setForm((f) => chooseKind(f, o.kind))}
          />
        ))}
      </View>

      {view.conditions ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title={t('decision:s15.conditionsTitle')} />
          {view.conditions.map((c) => (
            <View key={c.kind} style={{ gap: 6 }}>
              <Checkbox
                label={c.label}
                value={c.on}
                onChange={(on) => setForm((f) => ({ ...f, conditions: { ...f.conditions, [c.kind]: { ...f.conditions[c.kind], on } } }))}
              />
              {c.on && c.needsAmount ? (
                <MoneyField
                  label={t('decision:s15.amount')}
                  cents={c.amountCents}
                  error={tried ? (c.error ?? undefined) : undefined}
                  onChangeCents={(cents) =>
                    setForm((f) => ({ ...f, conditions: { ...f.conditions, [c.kind]: { ...f.conditions[c.kind], amountCents: cents } } }))
                  }
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {view.reasons ? (
        <View style={{ gap: 8 }}>
          <SectionHeader title={t('decision:s15.reasonsTitle')} />
          {view.reasons.items.map((r) => (
            <OptionCard
              key={r.id}
              kind="checkbox"
              title={r.title}
              description={r.description}
              selected={r.on}
              onPress={() => setForm((f) => toggleReason(f, r.id, !r.on))}
            />
          ))}
          {tried && view.reasons.error ? <Banner tone="warn">{view.reasons.error}</Banner> : null}
          <TextField
            label={t('decision:s15.noteLabel')}
            value={form.note}
            multiline
            onChangeText={(note) => setForm((f) => ({ ...f, note }))}
          />
        </View>
      ) : null}

      {view.showReportBox ? (
        <Checkbox label={t('decision:s15.reportBox')} value={form.reportInfluenced} onChange={(v) => setForm((f) => ({ ...f, reportInfluenced: v }))} />
      ) : null}

      {view.warnings.map((w) => (
        <Banner key={w} tone="warn" icon={TriangleAlert}>
          {w}
        </Banner>
      ))}
      {tried && view.formError ? <Banner tone="warn">{view.formError}</Banner> : null}
      {view.noticeHint && !tried ? <Hint>{view.noticeHint}</Hint> : null}
      <LegalFooter />

      <ConfirmDialog
        visible={!!notice}
        tone="warn"
        title={t('decision:s15.noticeTitle')}
        body={`${t('decision:s15.noticeBody')}\n\n${t('decision:s15.noticeDecision')}: ${notice?.summary ?? ''}`}
        cancelLabel={t('decision:s15.later')}
        confirmLabel={t('decision:s09.createNotice')}
        onCancel={() => {
          setNotice(null);
          router.back();
        }}
        onConfirm={() => {
          const n = notice!;
          setNotice(null);
          router.replace(routes.letter(id, { decisionId: n.decisionId, kind: 'adverse_action' }));
        }}
      />
    </Screen>
  );
}
