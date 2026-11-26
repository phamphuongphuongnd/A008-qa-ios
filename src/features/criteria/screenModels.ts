/**
 * Pure view logic of S-04 (criterion cards, footer button) and S-05 (paper preview) — tested without rendering.
 */
import {
  DOC_TYPE_LABELS,
  criterionTitle,
  formatMultiple,
  type CriteriaError,
  type CriteriaWarning,
  type Criterion,
  type DocType,
  type PetPolicy,
} from '@/engine';
import { t } from '@/i18n';
import type { PublishedCriteria } from '@/pdf/publishedCriteria';

import { canSave, isDirty, isEditable, stepLimits, type CriteriaEditorState } from './criteriaEditor';

export type ParamModel =
  | { kind: 'stepper'; label: string; display: string; canDecrement: boolean; canIncrement: boolean; a11y: string }
  | { kind: 'voucherShare'; label: string; value: boolean }
  | { kind: 'petPolicy'; label: string; value: PetPolicy; options: { value: PetPolicy; label: string }[] }
  | { kind: 'documents'; label: string; options: { value: DocType; label: string; selected: boolean }[]; otherLabel: string | null };

export interface CriterionCardModel {
  id: string;
  /** "C1" … or "Yes/No" for a custom one. */
  codeLabel: string;
  title: string;
  help: string;
  /** Shows "Why this matters" (Guide). */
  guideLink: boolean;
  enabled: boolean;
  custom: boolean;
  /** Parameter rows (only when enabled and editable — mockup: locked / off cards are collapsed). */
  params: ParamModel[];
  /** Error from validation (range, no documents, prohibited title). */
  error: string | null;
  /** Warning cards attached to this criterion (C1 voucher, C7 occupancy, C9 credit, C10 local law). */
  warnings: CriteriaWarning[];
}

const DOC_ORDER: DocType[] = ['photo_id', 'proof_of_income', 'bank_statement', 'reference_letter', 'voucher_letter', 'other'];
const PET_ORDER: PetPolicy[] = ['no_pets', 'cats_only', 'cats_and_dogs', 'case_by_case'];

function stepper(c: Criterion, label: string, display: string): ParamModel {
  const lim = stepLimits(c);
  return {
    kind: 'stepper',
    label,
    display,
    canDecrement: lim.canDecrease,
    canIncrement: lim.canIncrease,
    a11y: t('units:s04.stepperA11y', { label, value: display }),
  };
}

function params(c: Criterion): ParamModel[] {
  switch (c.code) {
    case 'C1':
      return [
        stepper(c, t('units:s04.params.multiple'), `${formatMultiple(c.params.multipleTenths)}×`),
        { kind: 'voucherShare', label: t('units:s04.params.voucherShare'), value: c.params.applyToTenantShare },
      ];
    case 'C2':
      return [stepper(c, t('units:s04.params.months'), String(c.params.months))];
    case 'C3':
      return [stepper(c, t('units:s04.params.years'), String(c.params.years))];
    case 'C6': {
      const other = c.params.documents.find((d) => d.type === 'other');
      return [
        {
          kind: 'documents',
          label: t('units:s04.params.documents'),
          options: DOC_ORDER.map((value) => ({
            value,
            label: DOC_TYPE_LABELS[value],
            selected: c.params.documents.some((d) => d.type === value),
          })),
          otherLabel: other ? (other.label ?? '') : null,
        },
      ];
    }
    case 'C7':
      return [stepper(c, t('units:s04.params.perBedroom'), String(c.params.perBedroom))];
    case 'C8': {
      const rows: ParamModel[] = [
        {
          kind: 'petPolicy',
          label: t('units:s04.params.policy'),
          value: c.params.policy,
          options: PET_ORDER.map((value) => ({ value, label: t(`units:s04.petPolicy.${value}`) })),
        },
      ];
      if (c.params.policy === 'cats_and_dogs') rows.push(stepper(c, t('units:s04.params.maxPets'), String(c.params.maxPets)));
      return rows;
    }
    case 'C9':
      return [stepper(c, t('units:s04.params.minScore'), String(c.params.minScore))];
    case 'C10':
      return [stepper(c, t('units:s04.params.lookback'), t('units:s04.params.lookbackValue', { count: c.params.lookbackYears }))];
    default:
      return [];
  }
}

function help(c: Criterion): string {
  if (c.code === 'CX') return t(c.params.answeredBy === 'applicant' ? 'units:s04.customApplicant' : 'units:s04.customLandlord');
  return t(`units:s04.help.${c.code}`);
}

/** One S-04 card. Off cards keep their help line; parameters appear when on (and editable). */
export function criterionCard(
  c: Criterion,
  ctx: { editable: boolean; errors: readonly CriteriaError[]; warnings: readonly CriteriaWarning[] },
): CriterionCardModel {
  const custom = c.code === 'CX';
  return {
    id: c.id,
    codeLabel: custom ? t('units:s04.customCode') : c.code,
    title: criterionTitle(c),
    help: help(c),
    guideLink: c.code === 'C4',
    enabled: c.enabled,
    custom,
    params: c.enabled && ctx.editable ? params(c) : [],
    error: ctx.errors.find((e) => e.criterionId === c.id)?.message ?? null,
    warnings: ctx.warnings.filter((w) => w.criterionId === c.id),
  };
}

export function criterionCards(s: CriteriaEditorState, errors: readonly CriteriaError[], warnings: readonly CriteriaWarning[]): CriterionCardModel[] {
  const editable = isEditable(s);
  return [...s.draft].sort((a, b) => a.order - b.order).map((c) => criterionCard(c, { editable, errors, warnings }));
}

export type FooterAction = 'save' | 'saveAndPreview' | 'preview';

/**
 * S-04 bottom button. Setup pass (S-03 → S-04 → S-05): "Preview published criteria" saves first. Later visits: "Save"
 * while there are edits, else "Preview published criteria".
 */
export function criteriaFooter(
  s: CriteriaEditorState,
  setup: boolean,
  /** Other unsaved edits on the screen (smoking policy). */
  otherDirty = false,
): { label: string; action: FooterAction; disabled: boolean } {
  const preview = t('units:s04.preview');
  if (!isEditable(s)) return { label: preview, action: 'preview', disabled: false };
  if (setup) return { label: preview, action: 'saveAndPreview', disabled: !canSave(s) };
  if (isDirty(s) || otherDirty) return { label: t('units:s04.save'), action: 'save', disabled: !canSave(s) };
  return { label: preview, action: 'preview', disabled: false };
}

/** S-05 paper: headings + mockup line joins ("Bring" with " · ", "Good to know" as one paragraph). */
export function paperModel(p: PublishedCriteria): {
  title: string;
  meta: string;
  checks: string[];
  bring: string | null;
  howWeReview: string | null;
  goodToKnow: string;
  fairHousing: string;
} {
  return {
    title: p.title,
    meta: `${p.address} · ${p.terms}`,
    checks: p.checks,
    bring: p.bring.length ? p.bring.join(' · ') : null,
    howWeReview: p.howWeReview,
    goodToKnow: p.goodToKnow.join(' '),
    fairHousing: p.fairHousing,
  };
}
