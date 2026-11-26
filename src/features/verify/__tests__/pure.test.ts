import {
  attemptResultKey,
  backgroundGate,
  backgroundPatch,
  backgroundState,
  countyRecordsSearchUrl,
  emptyConviction,
  emptyLandlordForm,
  emptyReportForm,
  employerPatch,
  howLongAgoText,
  isCaseDate,
  isIsoDate,
  isOpenableUrl,
  isReportTooOld,
  isSafeWebUrl,
  landlordEmailDraft,
  landlordPatch,
  localTimestamp,
  missingCompanyFields,
  moneyInputText,
  openExternal,
  parseMoneyInput,
  reportPatch,
  toBackgroundForm,
  toEmployerForm,
  toLandlordForm,
  toReportForm,
  unreachableState,
  validateBackgroundForm,
  validateEmployerForm,
  validateLandlordForm,
  validateReportForm,
  yearsAndMonthsBetween,
  type BackgroundForm,
} from '..';
import type { Reference, Report } from '@/db/types';

const TODAY = '2026-12-10';

describe('common', () => {
  test('parseMoneyInput: integer cents, no float drift', () => {
    expect(parseMoneyInput('$2,310.00')).toBe(231000);
    expect(parseMoneyInput('2310')).toBe(231000);
    expect(parseMoneyInput('0.1')).toBe(10);
    expect(parseMoneyInput('1,550.5')).toBe(155050);
    expect(parseMoneyInput('19.99')).toBe(1999);
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('  ')).toBeNull();
    for (const bad of ['abc', '-5', '1.234', '12,34', '1e3']) expect(parseMoneyInput(bad)).toBeNaN();
  });
  test('moneyInputText', () => {
    expect(moneyInputText(231050)).toBe('2,310.50');
    expect(moneyInputText(5)).toBe('0.05');
    expect(moneyInputText(null)).toBe('');
  });
  test('isIsoDate rejects impossible dates', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-01')).toBe(false);
  });
  test('yearsAndMonthsBetween floors', () => {
    expect(yearsAndMonthsBetween('2020-06-15', '2026-12-15')).toEqual({ years: 6, months: 6 });
    expect(yearsAndMonthsBetween('2020-06-15', '2026-12-14')).toEqual({ years: 6, months: 5 });
    expect(yearsAndMonthsBetween('2026-12-20', '2026-12-10')).toEqual({ years: 0, months: 0 });
  });
  test('attempt label: email with no answer reads "No reply yet"', () => {
    expect(attemptResultKey('email', 'no_answer')).toBe('attempts.result.no_reply');
    expect(attemptResultKey('call', 'no_answer')).toBe('attempts.result.no_answer');
    expect(attemptResultKey('call', 'left_message')).toBe('attempts.result.left_message');
  });
  test('localTimestamp carries the device offset', () => {
    expect(localTimestamp(new Date())).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });
  test('only https / mailto links open', async () => {
    expect(isSafeWebUrl('https://www.mysmartmove.com/')).toBe(true);
    expect(isSafeWebUrl('http://example.com')).toBe(false);
    expect(isSafeWebUrl('javascript:alert(1)')).toBe(false);
    expect(isOpenableUrl('mailto:a@b.co?subject=x')).toBe(true);
    expect(isOpenableUrl('tel:123')).toBe(false);
    const native = { openUrl: jest.fn().mockResolvedValue(undefined) };
    expect(await openExternal(native, 'file:///etc/passwd')).toBe(false);
    expect(native.openUrl).not.toHaveBeenCalled();
    expect(await openExternal(native, 'https://checkr.com/')).toBe(true);
    expect(await openExternal({ openUrl: jest.fn().mockRejectedValue(new Error('no app')) }, 'https://checkr.com/')).toBe(false);
  });
});

const ref = (over: Partial<Reference>): Reference => ({
  id: 1,
  applicantId: 1,
  kind: 'landlord',
  residenceId: 1,
  incomeId: null,
  contactName: null,
  contactPhone: null,
  ownerConfirmed: false,
  confirmSource: null,
  answers: null,
  notes: null,
  unreachable: false,
  updatedAt: '2026-12-01T00:00:00Z',
  ...over,
});

describe('S-11 landlord form', () => {
  test('prefills the contact from the application, then from the saved sheet', () => {
    expect(toLandlordForm(null, { landlordName: 'Ann Lee', landlordPhone: '555' }).contactName).toBe('Ann Lee');
    const f = toLandlordForm(ref({ contactName: 'County owner', answers: { rentCents: 155000, owes: 'yes', owesCents: 50000 } }), { landlordName: 'Ann Lee' });
    expect(f.contactName).toBe('County owner');
    expect(f.rentText).toBe('1,550.00');
    expect(f.owesText).toBe('500.00');
  });
  test('validation', () => {
    const f = { ...emptyLandlordForm(), ownerConfirmed: true, from: '2024-05', to: '2023-01', rentText: 'abc', owes: 'yes' as const };
    expect(validateLandlordForm(f).map((e) => `${e.field}:${e.code}`)).toEqual([
      'confirmSource:required',
      'to:range_order',
      'rentText:money_invalid',
      'owesText:required',
    ]);
    expect(validateLandlordForm({ ...emptyLandlordForm(), owes: 'yes', owesText: '0' })[0].code).toBe('money_zero');
    expect(validateLandlordForm({ ...emptyLandlordForm(), from: '2023-01', to: 'still_there' })).toEqual([]);
    expect(validateLandlordForm(emptyLandlordForm())).toEqual([]);
  });
  test('patch: answeredOn = date of the call, kept when answers are unchanged, cleared when blank', () => {
    const f = { ...emptyLandlordForm(), rentAgain: 'no' as const, rentAgainWhy: ' Late ', rentText: '1,200', owes: 'no' as const, owesText: '99' };
    const p = landlordPatch(f, null, TODAY);
    expect(p.answers).toMatchObject({ rentAgain: 'no', rentAgainWhy: 'Late', rentCents: 120000, owes: 'no', owesCents: null, answeredOn: TODAY });
    const saved = ref({ answers: p.answers });
    expect(landlordPatch(toLandlordForm(saved), saved, '2026-12-20').answers?.answeredOn).toBe(TODAY);
    expect(landlordPatch({ ...toLandlordForm(saved), rentAgain: 'yes' }, saved, '2026-12-20').answers).toMatchObject({ answeredOn: '2026-12-20', rentAgainWhy: null });
    expect(landlordPatch(emptyLandlordForm(), saved, '2026-12-20').answers?.answeredOn).toBeNull();
  });
  test('unreachable rule comes from the engine (≥ 3 failed tries by ≥ 2 methods)', () => {
    const a = (method: 'call' | 'email', result: 'no_answer' | 'reached' = 'no_answer') => ({ at: '2026-12-03T10:00:00-05:00', method, result });
    expect(unreachableState([a('call'), a('call')], false).canMark).toBe(false);
    expect(unreachableState([a('call'), a('call'), a('call')], false).canMark).toBe(false);
    const ok = unreachableState([a('call'), a('call'), a('email')], false);
    expect(ok).toMatchObject({ canMark: true, failedCount: 3, methodCount: 2 });
    expect(unreachableState([a('call'), a('call'), a('email')], true).canMark).toBe(false);
  });
  test('county records link: address only, encoded', () => {
    const url = countyRecordsSearchUrl('88 Elm St, Columbus, OH 43215');
    expect(url).toBe('https://www.google.com/search?q=88%20Elm%20St%2C%20Columbus%2C%20OH%2043215%20county%20property%20records');
    expect(isSafeWebUrl(url)).toBe(true);
  });
  test('verification email: the 9 questions, no stated rent / dates, mailto encoded', () => {
    const m = landlordEmailDraft({ to: 'owner@example.com', applicantName: 'Marcus Webb', address: '88 Elm St', landlordName: 'Ann' });
    expect(m.subject).toBe('Rental reference for Marcus Webb — 88 Elm St');
    expect(m.body).toContain('Hello Ann,');
    expect(m.body).toContain('1. Did Marcus Webb rent from you at 88 Elm St?');
    expect(m.body).toContain('9. Would you rent to them again?');
    expect(m.body).not.toMatch(/\$|1,200|2022/);
    expect(m.url.startsWith('mailto:owner%40example.com?subject=Rental%20reference')).toBe(true);
    expect(m.url).not.toContain(' ');
    expect(decodeURIComponent(m.url.split('&body=')[1])).toBe(m.body);
    expect(landlordEmailDraft({ to: null, applicantName: 'A', address: 'B' }).body.startsWith('Hello,')).toBe(true);
  });
});

describe('S-12 employer form', () => {
  test('validate + patch', () => {
    expect(validateEmployerForm({ ...toEmployerForm(null), since: '2027-01' }, '2026-12')[0]).toEqual({ field: 'since', code: 'date_future' });
    const p = employerPatch({ ...toEmployerForm(null), employed: 'yes', since: '2021-04', title: ' Driver ', contactPhone: '555' }, null, TODAY);
    expect(p.answers).toEqual({ employed: 'yes', since: '2021-04', title: 'Driver', answeredOn: TODAY });
    expect(employerPatch({ ...toEmployerForm(null), employed: 'no', since: '2021-04', title: 'X' }, null, TODAY).answers).toMatchObject({ since: null, title: null });
    expect(employerPatch(toEmployerForm(null), null, TODAY).answers?.answeredOn).toBeNull();
  });
});

const reportRow = (over: Partial<Report>): Report => ({
  id: 1,
  applicantId: 1,
  service: null,
  companyName: null,
  companyAddress: null,
  companyPhone: null,
  reportDate: null,
  evictions: null,
  landlordCollectionsCents: null,
  score: null,
  noScore: false,
  scoreModel: null,
  scoreRange: null,
  scoreDate: null,
  keyFactors: null,
  filePaths: null,
  updatedAt: '2026-12-01T00:00:00Z',
  ...over,
});

describe('S-13 report form', () => {
  test('engine conventions: null = not entered, [] / 0 = none', () => {
    expect(toReportForm(reportRow({}))).toMatchObject({ evictionsMode: 'not_entered', collectionsMode: 'not_entered' });
    expect(toReportForm(reportRow({ evictions: [], landlordCollectionsCents: 0 }))).toMatchObject({ evictionsMode: 'none', collectionsMode: 'none' });
    expect(toReportForm(reportRow({ evictions: [{ date: '2021', outcome: 'settled' }], landlordCollectionsCents: 231000 }))).toMatchObject({
      evictionsMode: 'listed',
      collectionsMode: 'listed',
      collectionsText: '2,310.00',
    });
    const base = emptyReportForm();
    expect(reportPatch(base, { c9Enabled: false })).toMatchObject({ evictions: null, landlordCollectionsCents: null });
    expect(reportPatch({ ...base, evictionsMode: 'none', collectionsMode: 'none' }, { c9Enabled: false })).toMatchObject({ evictions: [], landlordCollectionsCents: 0 });
    expect(
      reportPatch({ ...base, evictionsMode: 'listed', cases: [{ date: ' 2021 ', outcome: 'settled' }], collectionsMode: 'listed', collectionsText: '$2,310' }, { c9Enabled: false }),
    ).toMatchObject({ evictions: [{ date: '2021', outcome: 'settled' }], landlordCollectionsCents: 231000 });
  });
  test('validation', () => {
    const f = { ...emptyReportForm(), reportDate: '2026-12-11', evictionsMode: 'listed' as const, cases: [{ date: '2021-13', outcome: null }], collectionsMode: 'listed' as const };
    expect(validateReportForm(f, { c9Enabled: false, today: TODAY }).map((e) => `${e.field}:${e.code}`)).toEqual([
      'reportDate:date_future',
      'cases.0.date:date_invalid',
      'cases.0.outcome:required',
      'collectionsText:required',
    ]);
    expect(validateReportForm({ ...emptyReportForm(), evictionsMode: 'listed' }, { c9Enabled: false, today: TODAY })[0].code).toBe('required');
  });
  test('case dates: year / month / day, not in the future', () => {
    expect(isCaseDate('2021', TODAY)).toBe(true);
    expect(isCaseDate('2026-12', TODAY)).toBe(true);
    expect(isCaseDate('2027', TODAY)).toBe(false);
    expect(isCaseDate('2026-12-11', TODAY)).toBe(false);
    expect(isCaseDate('2021-02-30', TODAY)).toBe(false);
  });
  test('C9: score needs model, range, date, ≤ 4 key factors; ignored when C9 is off', () => {
    const f = { ...emptyReportForm(), scoreText: '640', keyFactors: ['a', 'b', 'c', 'd', 'e'] };
    expect(validateReportForm(f, { c9Enabled: true, today: TODAY }).map((e) => e.field)).toEqual(['scoreModel', 'scoreRange', 'scoreDate', 'keyFactors']);
    expect(validateReportForm(f, { c9Enabled: false, today: TODAY })).toEqual([]);
    expect(reportPatch(f, { c9Enabled: false })).toMatchObject({ score: null, noScore: false, keyFactors: [] });
    const ok = { ...f, scoreModel: 'VantageScore 3.0', scoreRange: '300–850', scoreDate: '2026-12-03', keyFactors: ['Late payments', ' ', 'High balance'] };
    expect(validateReportForm(ok, { c9Enabled: true, today: TODAY })).toEqual([]);
    expect(reportPatch(ok, { c9Enabled: true })).toMatchObject({ score: 640, keyFactors: ['Late payments', 'High balance'], scoreModel: 'VantageScore 3.0' });
    expect(reportPatch({ ...emptyReportForm(), noScore: true, scoreText: '700' }, { c9Enabled: true })).toMatchObject({ score: null, noScore: true });
    expect(validateReportForm({ ...emptyReportForm(), scoreText: 'abc', scoreModel: 'x', scoreRange: 'y', scoreDate: TODAY }, { c9Enabled: true, today: TODAY })[0].code).toBe('score_invalid');
  });
  test('company fields the FCRA letter needs; 30-day rule', () => {
    expect(missingCompanyFields({ companyName: 'TURSS', companyAddress: ' ', companyPhone: '' })).toEqual(['address', 'phone']);
    expect(isReportTooOld('2026-11-10', TODAY)).toBe(false);
    expect(isReportTooOld('2026-11-09', TODAY)).toBe(true);
    expect(isReportTooOld(null, TODAY)).toBe(false);
  });
});

describe('S-14 background', () => {
  test('gate: only after a Conditional offer; never when C10 is off', () => {
    expect(backgroundGate({ c10Enabled: false, conditionalOfferAt: '2026-12-05T10:00:00-05:00', status: 'conditional_offer' })).toBe('not_in_criteria');
    expect(backgroundGate({ c10Enabled: true, conditionalOfferAt: null, status: 'in_review' })).toBe('locked');
    expect(backgroundGate({ c10Enabled: true, conditionalOfferAt: '2026-12-05T10:00:00-05:00', status: 'conditional_offer' })).toBe('open');
    expect(backgroundGate({ c10Enabled: true, conditionalOfferAt: '2026-12-05T10:00:00-05:00', status: 'approved' })).toBe('read_only');
  });
  test('validation', () => {
    const f: BackgroundForm = { ...toBackgroundForm(null), mode: 'listed', convictions: [{ type: null, convictedOn: '2020-06-15', sentenceEndedOn: '2020-01-01' }, { ...emptyConviction(), type: 'drug', convictedOn: '2027-01-01' }] };
    expect(validateBackgroundForm(f, TODAY).map((e) => `${e.field}:${e.code}`)).toEqual([
      'convictions.0.type:required',
      'convictions.0.sentenceEndedOn:sentence_before_conviction',
      'convictions.1.convictedOn:date_future',
    ]);
    expect(validateBackgroundForm({ ...f, convictions: [] }, TODAY)[0]).toEqual({ field: 'mode', code: 'required' });
  });
  test('"How long ago" is calculated (mockup: 6 years, 6 months)', () => {
    expect(howLongAgoText('2020-06-01', '2026-12-10')).toBe('6 years, 6 months');
    expect(howLongAgoText('2025-12-10', '2026-12-10')).toBe('1 year');
    expect(howLongAgoText('2026-11-01', '2026-12-10')).toBe('1 month');
  });
  const offer = '2026-12-05T10:00:00-05:00';
  const ctx = { gate: 'open' as const, lookbackYears: 7, conditionalOfferAt: offer, today: TODAY };
  test('never auto-denies: withdraw needs a conviction in the lookback + the assessment', () => {
    const none = backgroundState({ ...toBackgroundForm(null), mode: 'none' }, ctx);
    expect(none).toMatchObject({ continueBlock: null, withdrawBlock: 'no_convictions_in_lookback', needsAssessment: false });
    const f: BackgroundForm = { ...toBackgroundForm(null), mode: 'listed', convictions: [{ type: 'property', convictedOn: '2020-06-01', sentenceEndedOn: '2020-12-01' }, { type: 'fraud', convictedOn: '2015-01-01', sentenceEndedOn: null }] };
    const s = backgroundState(f, ctx);
    expect(s.convictions.map((c) => c.inLookback)).toEqual([true, false]);
    expect(s).toMatchObject({ needsAssessment: true, continueBlock: null, withdrawBlock: 'assessment_required', missing: ['seriousness', 'rehabilitation', 'other'] });
    const done = backgroundState({ ...f, seriousness: 'Shoplifting, single offense.', rehabilitation: 'Clean record since', other: 'Nothing' }, ctx);
    expect(done.withdrawBlock).toBeNull();
    expect(backgroundState(f, { ...ctx, gate: 'read_only' }).continueBlock).toBe('not_editable');
    expect(backgroundState(toBackgroundForm(null), ctx).continueBlock).toBe('not_entered');
  });
  test('patch: convictions only when listed; reviewedOn = today', () => {
    const p = backgroundPatch({ mode: 'listed', convictions: [{ type: 'drug', convictedOn: '2021-03-04', sentenceEndedOn: null }, emptyConviction()], seriousness: ' x ', rehabilitation: '', other: '' }, TODAY);
    expect(p).toEqual({ noConvictions: false, convictions: [{ type: 'drug', convictedOn: '2021-03-04', sentenceEndedOn: null }], assessment: { seriousness: 'x', rehabilitation: null, other: null }, reviewedOn: TODAY });
    expect(backgroundPatch({ ...toBackgroundForm(null), mode: 'none', seriousness: 'stale' }, TODAY)).toMatchObject({ noConvictions: true, convictions: [], assessment: {}, reviewedOn: TODAY });
    expect(backgroundPatch(toBackgroundForm(null), TODAY).reviewedOn).toBeNull();
  });
});
