import { SAMPLE_CRITERIA, criteriaWarnings, defaultCriteria, validateCriteria, type Criterion } from '@/engine';

import { criteriaEditorReducer as reduce, initCriteriaEditor } from '../criteriaEditor';
import { criteriaFooter, criterionCard, criterionCards, paperModel } from '../screenModels';
import { publishedCriteriaContent } from '@/pdf/publishedCriteria';

jest.mock('@/pdf/shellNative', () => ({ expoPdfAdapter: {} }));

const saved = (): Criterion[] => defaultCriteria().map((c, i) => ({ ...c, id: String(i + 1) }));
const ctx = { editable: true, errors: [], warnings: [] };

describe('S-04 criterion cards', () => {
  it('shows the mockup params for C1 (3.0× + voucher switch)', () => {
    const card = criterionCard(saved()[0], ctx);
    expect(card).toMatchObject({ codeLabel: 'C1', title: 'Income: at least 3.0× the rent', help: 'Gross household income vs monthly rent.', enabled: true });
    expect(card.params).toEqual([
      { kind: 'stepper', label: 'Multiple', display: '3.0×', canDecrement: true, canIncrement: true, a11y: 'Multiple, 3.0×' },
      { kind: 'voucherShare', label: "Apply to tenant's share when a voucher pays part", value: true },
    ]);
  });

  it('collapses off and locked cards, links C4 to the Guide', () => {
    const list = saved();
    expect(criterionCard(list[8], ctx)).toMatchObject({ codeLabel: 'C9', enabled: false, params: [], help: 'Off by default. Some states limit this.' });
    expect(criterionCard(list[0], { ...ctx, editable: false }).params).toEqual([]);
    expect(criterionCard(list[3], ctx).guideLink).toBe(true);
  });

  it('builds pets, documents, lookback and custom cards', () => {
    const list = saved();
    const c8 = criterionCard({ ...list[7], params: { policy: 'cats_and_dogs', maxPets: 2 } } as Criterion, ctx);
    expect(c8.params.map((p) => p.kind)).toEqual(['petPolicy', 'stepper']);
    expect(criterionCard(list[7], ctx).params.map((p) => p.kind)).toEqual(['petPolicy']);
    const c6 = criterionCard(list[5], ctx).params[0];
    expect(c6.kind === 'documents' && c6.options.filter((o) => o.selected).map((o) => o.label)).toEqual(['Photo ID', 'Proof of income']);
    const c10 = criterionCard({ ...list[9], enabled: true }, ctx).params[0];
    expect(c10.kind === 'stepper' && c10.display).toBe('7 yrs');
    const cx = criterionCard({ id: 'new-1', code: 'CX', enabled: true, order: 11, params: { title: 'Has renters insurance', answeredBy: 'landlord' } }, ctx);
    expect(cx).toMatchObject({ codeLabel: 'Yes/No', custom: true, help: 'You check it and mark yes or no.', params: [] });
  });

  it('attaches errors and warnings to their card', () => {
    const list = saved().map((c) => (c.code === 'C7' ? ({ ...c, params: { perBedroom: 1 } } as Criterion) : c));
    const noDocs = list.map((c) => (c.code === 'C6' ? ({ ...c, params: { documents: [] } } as Criterion) : c));
    const s = initCriteriaEditor(noDocs, false);
    const cards = criterionCards(s, validateCriteria(noDocs), criteriaWarnings(noDocs));
    expect(cards.find((c) => c.codeLabel === 'C6')!.error).toBe('Choose at least one document');
    expect(cards.find((c) => c.codeLabel === 'C7')!.warnings.map((w) => w.code)).toEqual(['occupancy_below_two']);
  });
});

describe('S-04 footer button', () => {
  it('setup: always "Preview published criteria" (saves first)', () => {
    const s = initCriteriaEditor(saved(), false);
    expect(criteriaFooter(s, true)).toEqual({ label: 'Preview published criteria', action: 'saveAndPreview', disabled: false });
  });

  it('later visits: Save while edited, else Preview; disabled when invalid', () => {
    let s = initCriteriaEditor(saved(), false);
    expect(criteriaFooter(s, false).action).toBe('preview');
    expect(criteriaFooter(s, false, true)).toMatchObject({ label: 'Save', action: 'save' });
    s = reduce(s, { type: 'toggleDocument', id: '6', doc: 'photo_id', on: false });
    expect(criteriaFooter(s, false)).toMatchObject({ action: 'save', disabled: false });
    s = reduce(s, { type: 'toggleDocument', id: '6', doc: 'proof_of_income', on: false });
    expect(criteriaFooter(s, false).disabled).toBe(true);
  });

  it('locked: Preview only until unlocked with a reason', () => {
    let s = initCriteriaEditor(saved(), true);
    expect(criteriaFooter(s, false).action).toBe('preview');
    s = [
      { type: 'requestUnlock' } as const,
      { type: 'setReason', reason: 'Typo' } as const,
      { type: 'confirmUnlock' } as const,
      { type: 'step', id: '2', delta: 1 } as const,
    ].reduce(reduce, s);
    expect(criteriaFooter(s, false)).toMatchObject({ action: 'save', disabled: false });
  });
});

describe('S-05 paper', () => {
  it('joins lines like the mockup', () => {
    const p = paperModel(
      publishedCriteriaContent(
        { street: '1428 Maple St', unit: 'Unit B', city: 'Columbus', state: 'OH', zip: '43215', rentCents: 165000, availableOn: '2027-01-01', depositCents: null, feeCents: 0, smokingPolicy: 'non_smoking', reviewMode: 'compare' },
        SAMPLE_CRITERIA,
      ),
    );
    expect(p.meta).toBe('1428 Maple St, Unit B, Columbus, OH 43215 · $1,650/mo · Available Jan 1, 2027');
    expect(p.bring).toBe('Photo ID · Proof of income (2 recent pay stubs, offer letter, or benefits / voucher letter)');
    expect(p.goodToKnow).toBe(
      'We do not charge an application fee. Non-smoking property. You may ask for more time or a reasonable accommodation. We do not ask for your Social Security number on this application.',
    );
    expect(p.howWeReview).toBeNull();
  });
});
