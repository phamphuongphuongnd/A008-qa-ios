import * as A from '@/db/repos/applicants';
import * as R from '@/db/repos/rentals';
import * as V from '@/db/repos/verify';

import { loadRentalHub } from '@/features/units/rentalQueries';

import { checkDecision, loadDecisionContext, requestMissingInfo, saveDecisionAction, syncQueueStatus } from '../decision';
import { decisionFileData } from '../decisionFile';
import { buildLetterInput, letterText, loadLetterContext } from '../letters';
import { evidenceDetail, loadApplicantReview, loadCompare, loadQueue } from '../review';
import { makeDeps, sampleDb } from '../testing/helpers';
import {
  applicantDetailView,
  chooseKind,
  compareCellTap,
  compareView,
  decisionFilePreview,
  decisionFormView,
  decisionInputOf,
  evidenceSheetView,
  initialDecisionForm,
  isDecisionDirty,
  letterPaper,
  letterScreenView,
  metCount,
  missingInfoSheet,
  parseDecisionKind,
  pickLetterKind,
  queueRowView,
  referenceLinks,
  statusChip,
  toggleReason,
} from '../viewModel';

const NOW = '2026-12-05T10:00:00-05:00';

describe('shared', () => {
  it('status chip: Waiting for First-come applicants not yet at the front', () => {
    expect(statusChip('in_review')).toEqual({ label: 'In review', tone: 'accent' });
    expect(statusChip('new', 'waiting')).toEqual({ label: 'Waiting', tone: 'outline' });
    expect(statusChip('denied').label).toBe('Denied');
  });

  it('met count is only text for the Decision file', () => {
    expect(metCount([{ outcome: 'met' }, { outcome: 'not_met' }, { outcome: 'met' }])).toEqual({ met: 2, total: 3, text: '2 of 3 Met' });
  });
});

describe('S-09 applicant detail', () => {
  it('Jordan: ready, no issues, Make a decision enabled, no count anywhere', () => {
    const { db, id } = sampleDb();
    const v = applicantDetailView(loadApplicantReview(db, id('Jordan'), NOW)!);
    expect(v.name).toBe('Jordan Ellis');
    expect(v.received).toBe('Received Dec 2, 9:14 AM');
    expect(v.chip).toEqual({ label: 'New', tone: 'outline' });
    expect(v.summary).toEqual({ ready: true, title: 'Ready to decide', subtitle: 'Not a score. Same criteria for every applicant.' });
    expect(v.issues).toBeNull();
    expect(v.footer).toEqual({ kind: 'decide', enabled: true, hint: null });
    expect(v.inLine).toBeNull();
    expect(JSON.stringify(v)).not.toMatch(/ of \d+ Met/);
  });

  it('Priya: issues card with actions, sections in plain words', () => {
    const { db, id } = sampleDb();
    const v = applicantDetailView(loadApplicantReview(db, id('Priya'), NOW)!);
    expect(v.issues!.title).toBe(`${v.issues!.items.length} things to check`);
    expect(v.issues!.items.every((i) => i.action && i.action.href.startsWith('/'))).toBe(true);
    const s = Object.fromEntries(v.sections.map((x) => [x.key, x]));
    expect(s.report.value).toBe('Entered');
    expect(s.background.value).toBe('After offer');
    expect(s.documents.a11y).toBe('Documents, 1/2');
    expect(v.menu).toEqual({ edit: true, withdrawn: true, delete: true });
  });

  it('First-come: #n in line and the turn message under the disabled button', () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const v = applicantDetailView(loadApplicantReview(db, id('Priya'), NOW)!);
    expect(v.inLine).toBe('#2 in line');
    expect(v.chip.label).toBe('Waiting');
    expect(v.footer).toEqual({ kind: 'decide', enabled: false, hint: 'First-come mode: decide on #1 first' });
  });

  it('a pending FCRA notice replaces the decide button with "Create notice"', async () => {
    const { db, id } = sampleDb();
    const { deps } = makeDeps(db, '2026-12-06T20:12:00Z');
    const ctx = loadDecisionContext(db, id('Priya'), NOW)!;
    const c5 = ctx.reasonChoices.find((c) => c.reason.code === 'C5')!;
    const res = await saveDecisionAction(deps, id('Priya'), { kind: 'deny', conditions: [], reasons: [c5.reason], note: '', reportInfluenced: true });
    expect(res.ok).toBe(true);
    const v = applicantDetailView(loadApplicantReview(db, id('Priya'), NOW)!);
    expect(v.footer).toMatchObject({ kind: 'notice', label: 'Create notice' });
    expect((v.footer as { href: string }).href).toContain('kind=adverse_action');
    expect(v.menu.withdrawn).toBe(false);
  });

  it('withdrawn offer reads Denied with the reason note', async () => {
    const { db, id } = sampleDb();
    const { deps } = makeDeps(db);
    await saveDecisionAction(deps, id('Jordan'), { kind: 'conditional_offer', conditions: [], reasons: [], note: '', reportInfluenced: false });
    V.saveBackground(db, id('Jordan'), {
      noConvictions: false,
      convictions: [{ type: 'property', convictedOn: '2025-06-01', sentenceEndedOn: '2025-12-01' }],
      reviewedOn: '2026-12-06',
      assessment: { seriousness: 'Recent', rehabilitation: 'None', other: 'Nothing' },
    });
    const done = await saveDecisionAction(deps, id('Jordan'), { kind: 'withdraw_offer', conditions: [], reasons: [], note: 'Assessment', reportInfluenced: false });
    expect(done.ok).toBe(true);
    const v = applicantDetailView(loadApplicantReview(db, id('Jordan'), NOW)!);
    expect(v.chip.label).toBe('Denied');
    expect(v.statusNote).toBe('Offer withdrawn after background review');
    expect(v.footer.kind).toBe('letter');
  });

  it('reference links and evidence sheet', () => {
    const { db, id } = sampleDb();
    const priya = loadApplicantReview(db, id('Priya'), NOW)!;
    const links = referenceLinks(priya);
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].title).toMatch(/^(Landlord|Employer) · /);
    expect(links.every((l) => l.href.startsWith(`/verify/${id('Priya')}/`))).toBe(true);
    const dana = loadApplicantReview(db, id('Dana'), NOW)!;
    const c1 = dana.evaluation.results.find((r) => r.code === 'C1')!;
    const sheet = evidenceSheetView(evidenceDetail(c1, dana.bundle, dana.applicant));
    expect(sheet.rows.find((r) => r.label === 'Checked')!.value).toMatch(/· by you$/);
    expect(sheet.action?.href).toBe(`/applicants/${id('Dana')}/documents`);
  });
});

describe('S-15 decision form', () => {
  it('?kind= preselects only an offered kind', () => {
    const { db, id } = sampleDb();
    const ctx = loadDecisionContext(db, id('Priya'), NOW)!;
    expect(parseDecisionKind('deny')).toBe('deny');
    expect(parseDecisionKind(['withdraw_offer'])).toBe('withdraw_offer');
    expect(parseDecisionKind('nope')).toBeNull();
    expect(initialDecisionForm(ctx, 'deny').kind).toBe('deny');
    expect(initialDecisionForm(ctx, 'withdraw_offer').kind).toBeNull(); // no offer yet
  });

  it('deny: reasons required, FCRA box, notice hint once a report reason is ticked', () => {
    const { db, id } = sampleDb();
    const ctx = loadDecisionContext(db, id('Priya'), NOW)!;
    const blank = initialDecisionForm(ctx);
    let form = chooseKind(blank, 'deny');
    expect(isDecisionDirty(blank, form)).toBe(true);
    let view = decisionFormView(ctx, form, checkDecision(ctx, decisionInputOf(ctx, form)!));
    expect(view.reasons!.required).toBe(true);
    expect(view.reasons!.error).not.toBeNull();
    expect(view.showReportBox).toBe(true);
    expect(view.errors).toBeGreaterThan(0);
    expect(view.options.map((o) => o.title)).toContain('Deny');

    const c5 = ctx.reasonChoices.find((c) => c.reason.code === 'C5')!.reason.criterionId;
    form = toggleReason(form, c5, true);
    const input = decisionInputOf(ctx, form)!;
    expect(input.reasons.map((r) => r.code)).toEqual(['C5']);
    view = decisionFormView(ctx, form, checkDecision(ctx, input));
    expect(view.reasons!.error).toBeNull();
    expect(view.reasons!.items.find((i) => i.id === c5)!.description).toMatch(/^Not met · Screening report — /);
    expect(view.noticeHint).toBe('An adverse action notice will be required.');
    expect(toggleReason(form, c5, false).reasonIds).toEqual([]);
  });

  it('approve with conditions: an amount is needed for deposit / rent, not for a co-signer', () => {
    const { db, id } = sampleDb();
    const ctx = loadDecisionContext(db, id('Priya'), NOW)!;
    let form = chooseKind(initialDecisionForm(ctx), 'approve_with_conditions');
    form = { ...form, conditions: { ...form.conditions, higher_deposit: { on: true, amountCents: null }, cosigner: { on: true, amountCents: null } } };
    const view = decisionFormView(ctx, form, checkDecision(ctx, decisionInputOf(ctx, form)!));
    const byKind = Object.fromEntries(view.conditions!.map((c) => [c.kind, c]));
    expect(byKind.higher_deposit.error).toBe('Enter the amount');
    expect(byKind.cosigner.error).toBeNull();
    expect(byKind.cosigner.needsAmount).toBe(false);
    expect(decisionInputOf(ctx, form)!.conditions).toEqual([{ kind: 'higher_deposit', amountCents: null }, { kind: 'cosigner' }]);
  });

  it('approve carries no reasons or note', () => {
    const { db, id } = sampleDb();
    const ctx = loadDecisionContext(db, id('Jordan'), NOW)!;
    const form = { ...chooseKind(initialDecisionForm(ctx), 'approve'), note: 'x', reasonIds: ['a'] };
    expect(decisionInputOf(ctx, form)).toMatchObject({ kind: 'approve', reasons: [], note: '', conditions: [], reportInfluenced: false });
    expect(decisionFormView(ctx, form, null).reasons).toBeNull();
    expect(decisionInputOf(ctx, initialDecisionForm(ctx))).toBeNull();
  });
});

describe('S-16 letter', () => {
  it('adverse notice paper: reason, locked FCRA block, sign-off; screen view', async () => {
    const { db, id } = sampleDb();
    const { deps } = makeDeps(db, '2026-12-06T20:12:00Z');
    const ctx0 = loadDecisionContext(db, id('Priya'), NOW)!;
    const c5 = ctx0.reasonChoices.find((c) => c.reason.code === 'C5')!;
    const res = await saveDecisionAction(deps, id('Priya'), { kind: 'deny', conditions: [], reasons: [c5.reason], note: '', reportInfluenced: true });
    if (!res.ok) throw new Error(res.message);
    const ctx = loadLetterContext(db, id('Priya'), res.decisionId)!;
    const kind = pickLetterKind(ctx.kinds, 'nope');
    expect(kind).toBe('adverse_action');
    const paper = letterPaper(buildLetterInput(ctx, kind, letterText(ctx, kind), '2026-12-06'));
    expect(paper.dateText).toBe('December 6, 2026');
    expect(paper.re).toBe('Re: 1428 Maple St, Unit B, Columbus, OH 43215');
    expect(paper.reasons).toEqual({ label: 'Reason:', items: ['unpaid balance owed to a past landlord.'] });
    expect(paper.fcra!.lines.length).toBeGreaterThan(0);
    expect(paper.signOff[0]).toBe('Sincerely,');

    const v = letterScreenView(ctx, kind, null, '2026-12-06');
    expect(v.title).toBe('Adverse action notice');
    expect(v.subtitle).toBe('FCRA · Priya Raman');
    expect(v.kinds).toBeNull();
    expect(v.canMarkSent).toBe(false);
    expect(letterScreenView(ctx, kind, 'email', '2026-12-06')).toMatchObject({ canMarkSent: !v.blocked, markLabel: 'Mark as sent · Dec 6' });
  });
});

describe('S-17 compare', () => {
  it('columns in received order, Issues row last, no ranking', () => {
    const { db, rentalId } = sampleDb();
    const v = compareView(loadCompare(db, rentalId, { hideClosed: false })!);
    expect(v.state).toBe('table');
    expect(v.columns.map((c) => c.title)).toEqual(['Jordan E.', 'Priya R.', 'Marcus W.', 'Dana O.']);
    expect(v.columns[0].subtitle).toBe('Dec 2, 9:14 AM');
    const last = v.rows[v.rows.length - 1];
    expect(last).toMatchObject({ key: 'issues', label: 'Issues', bold: true });
    expect(last.cells[v.columns[0].key]).toEqual({ text: '0', tone: 'muted', bold: false });
  });

  it('tap on a cell: evidence sheet of that applicant (same as S-09); Issues row opens S-09', () => {
    const { db, rentalId, id } = sampleDb();
    const data = loadCompare(db, rentalId, { hideClosed: false })!;
    const v = compareView(data);
    const dana = v.columns.find((c) => c.title === 'Dana O.')!;
    const c1 = data.table.rows.find((r) => r.code === 'C1')!;
    const tap = compareCellTap(data, c1.criterionId, dana.key);
    expect(tap?.kind).toBe('evidence');
    if (tap?.kind !== 'evidence') return;
    const review = loadApplicantReview(db, id('Dana'), NOW)!;
    const s09 = evidenceSheetView(evidenceDetail(review.evaluation.results.find((r) => r.code === 'C1')!, review.bundle, review.applicant));
    expect(tap.sheet).toEqual({ ...s09, title: `Dana O. · ${s09.title}` });
    expect(compareCellTap(data, 'issues', dana.key)).toEqual({ kind: 'applicant', href: `/review/applicant/${id('Dana')}` });
    expect(compareCellTap(data, c1.criterionId, 'nobody')).toBeNull();
    expect(compareCellTap(data, 'no-such-criterion', dana.key)).toBeNull();
  });

  it('empty with fewer than two applicants', () => {
    const { db, rentalId, id } = sampleDb();
    for (const n of ['Priya', 'Marcus', 'Dana'] as const) A.updateApplicant(db, id(n), { draft: true });
    expect(compareView(loadCompare(db, rentalId, { hideClosed: false })!).state).toBe('empty');
  });
});

describe('S-18 order queue', () => {
  it('rows: number, line, buttons; expired offer leaves one way on', async () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const { deps, clock } = makeDeps(db, NOW);
    syncQueueStatus(db, rentalId, NOW); // S-18 does this on open
    let q = loadQueue(db, rentalId, NOW)!;
    const first = queueRowView(q.rows[0], q.currentId);
    expect(first).toMatchObject({ n: 1, active: true, name: 'Jordan Ellis' });
    expect(first.line).toBe('Dec 2, 9:14 AM · In review');
    expect(first.buttons[0]).toMatchObject({ action: 'review', label: 'Review', variant: 'primary' });
    expect(queueRowView(q.rows[1], q.currentId).line).toMatch(/· Waiting$/);
    expect(queueRowView(q.rows[1], q.currentId).buttons).toEqual([]);

    await saveDecisionAction(deps, id('Jordan'), { kind: 'conditional_offer', conditions: [], reasons: [], note: '', reportInfluenced: false });
    clock.advanceHours(49);
    q = loadQueue(db, rentalId, clock.now().toISOString())!;
    const expired = queueRowView(q.rows[0], q.currentId);
    expect(expired.buttons.map((b) => b.label)).toEqual(['Offer expired — move to next']);
    expect(expired.timer).toEqual({ label: 'Offer expired', calm: false });
    expect(expired.a11y).toMatch(/^Number 1 in order received, Jordan Ellis/);
  });

  it('B-65: the front applicant reads In review everywhere before S-18 is opened', () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    // No syncQueueStatus: Jordan is still stored as "new".
    expect(A.getApplicantBundle(db, id('Jordan'))!.applicant.status).toBe('new');
    expect(loadRentalHub(db, rentalId)!.applicants.map((a) => a.status)).toEqual(['in_review', 'new', 'new', 'new']);
    const q = loadQueue(db, rentalId, NOW)!;
    expect(queueRowView(q.rows[0], q.currentId).line).toBe('Dec 2, 9:14 AM · In review');
    const review = loadApplicantReview(db, id('Jordan'), NOW)!;
    expect(statusChip(review.applicant.status, review.queueEntry?.state)).toEqual({ label: 'In review', tone: 'accent' });
    // Compare mode keeps the stored status.
    R.updateRental(db, rentalId, { reviewMode: 'compare' });
    expect(loadRentalHub(db, rentalId)!.applicants[0].status).toBe('new');
  });

  it('B-65: "Move to next (incomplete)" shows disabled while the 72 h clock runs, usable once it ends', async () => {
    const { db, rentalId, id } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    A.setApplicantStatus(db, id('Jordan'), 'denied'); // Priya (2 items missing) is next
    const { deps, clock } = makeDeps(db, NOW);
    expect(await requestMissingInfo(deps, id('Priya'), 'email')).toMatchObject({ ok: true });
    let q = loadQueue(db, rentalId, clock.now().toISOString())!;
    const running = queueRowView(q.rows[1], q.currentId);
    expect(running.buttons.map((b) => [b.label, !!b.disabled])).toEqual([
      ['Review', false],
      ['Move to next (incomplete)', true],
    ]);
    clock.advanceHours(73);
    q = loadQueue(db, rentalId, clock.now().toISOString())!;
    expect(queueRowView(q.rows[1], q.currentId).buttons.map((b) => [b.label, !!b.disabled])).toEqual([
      ['Review', false],
      ['Move to next (incomplete)', false],
    ]);
  });

  it('missing-info sheet ends 72 h from now', () => {
    const { db, rentalId } = sampleDb();
    R.updateRental(db, rentalId, { reviewMode: 'first_come' });
    const q = loadQueue(db, rentalId, NOW)!;
    const s = missingInfoSheet(q.rows[1], new Date('2026-12-06T14:40:00Z'));
    expect(s.endsText).toMatch(/^Ends Dec 9, /);
    expect(s.missing).toEqual(q.rows[1].missing);
  });
});

describe('S-19 decision file', () => {
  it('preview: "N of M Met" for every applicant, decision short + reason codes, deleted line', async () => {
    const { db, rentalId, id } = sampleDb();
    const { deps } = makeDeps(db, '2026-12-06T20:12:00Z');
    const ctx = loadDecisionContext(db, id('Priya'), NOW)!;
    const c5 = ctx.reasonChoices.find((c) => c.reason.code === 'C5')!;
    await saveDecisionAction(deps, id('Priya'), { kind: 'deny', conditions: [], reasons: [c5.reason], note: '', reportInfluenced: true });
    const data = decisionFileData(db, rentalId, new Date('2026-12-20T15:00:00Z'))!;
    expect(data.rentalShortAddress).toBe('1428 Maple St, Unit B');
    const v = decisionFilePreview(data);
    expect(v.title).toBe('Decision file');
    expect(v.subtitle).toBe('1428 Maple St, Unit B · Exported Dec 20, 2026');
    expect(v.applicants[0].heading).toBe('1. Jordan Ellis — Dec 2, 9:14 AM');
    for (const a of v.applicants) expect(a.lines[0]).toMatch(/^\d+ of \d+ Met · /);
    const priya = v.applicants[1];
    expect(priya.lines[0]).toMatch(/^\d+ of \d+ Met · Denied Dec \d+, \d+:\d{2} [AP]M · C5 \(Screening report\)$/);
    expect(priya.lines).toContain('Adverse action notice: not created yet.');
  });
});
