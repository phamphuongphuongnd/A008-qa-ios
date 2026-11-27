/**
 * S-16 Letters → PDF (F-14, product.md §3.15, S-16): Adverse action notice (FCRA) · Denial letter · Conditional offer ·
 * Approval letter. Pure: data in, HTML out (print with `printToPdfAndShare` from ./shell).
 *
 * The landlord edits only the opening and closing paragraphs. Reasons, conditions, reply-by, the score block and the
 * FCRA block are rebuilt from the Decision + Screening report every time and can't be removed (S-16).
 * Wording lives in `src/i18n/en/decision.json` (`letters.*`).
 */
import type { CriterionCode, DecisionCondition, DecisionKind, LetterData, LetterKind } from '@/engine';
import { t } from '@/i18n';

import { date, html, multiline, pdfDocument, refFileName, section, usd, type SafeHtml } from './shell';

export interface LetterParty {
  name: string;
  address?: string | null;
  phone?: string | null;
}

export interface LetterReasonInput {
  code: CriterionCode;
  /** Criterion title (used for custom criteria). */
  title: string;
}

export interface LetterInput {
  kind: LetterKind;
  decisionKind: DecisionKind;
  /** Letter date `YYYY-MM-DD`. */
  date: string;
  /** "December 6, 2026" (formatted by the caller in local time). */
  dateText: string;
  recipient: LetterParty;
  /** Full Rental address ("1428 Maple St, Unit B, Columbus, OH 43215"). */
  rentalAddress: string;
  landlord: LetterParty;
  opening: string;
  closing: string;
  reasons: LetterReasonInput[];
  /** "Explain in your words" — printed only when no criterion was ticked. */
  note?: string | null;
  conditions: DecisionCondition[];
  /** Engine `letterData` (company, score block, FCRA lines, respondBy). */
  data: LetterData;
  /** respondBy formatted in local time: "Dec 8, 2026 at 3:12 PM". */
  respondByText?: string | null;
}

/** "Adverse action notice", "Denial letter", "Conditional offer", "Approval letter". */
export function letterTitle(kind: LetterKind): string {
  return t(`decision:letters.title.${kind}`);
}

/** Default editable paragraphs for a new letter (S-16 "câu mở / kết"). */
export function defaultLetterText(
  kind: LetterKind,
  decisionKind: DecisionKind,
  rentalAddress: string,
): { opening: string; closing: string } {
  const address = rentalAddress;
  let opening: string;
  if (kind === 'adverse_action') {
    opening =
      decisionKind === 'approve_with_conditions'
        ? t('decision:letters.opening.adverseConditions')
        : decisionKind === 'withdraw_offer'
          ? t('decision:letters.opening.adverseWithdraw', { address })
          : t('decision:letters.opening.adverseDeny');
  } else if (kind === 'denial') {
    opening =
      decisionKind === 'withdraw_offer'
        ? t('decision:letters.opening.withdraw', { address })
        : t('decision:letters.opening.denial', { address });
  } else if (kind === 'conditional_offer') {
    opening = t('decision:letters.opening.conditionalOffer', { address });
  } else {
    opening =
      decisionKind === 'approve_with_conditions'
        ? t('decision:letters.opening.approvalConditions', { address })
        : t('decision:letters.opening.approval', { address });
  }
  const closing =
    kind === 'conditional_offer' || kind === 'approval' ? t('decision:letters.closing.offer') : t('decision:letters.closing.decline');
  return { opening, closing };
}

/** Plain reason phrase for a letter ("unpaid balance owed to a past landlord"). */
export function letterReason(r: LetterReasonInput): string {
  return r.code === 'CX' ? r.title : t(`decision:letters.reasons.${r.code}`);
}

/** "Higher deposit: $2,475", "Co-signer or guarantor", "Higher rent: $1,800/mo". */
export function conditionText(c: DecisionCondition): string {
  const amount = c.amountCents != null ? usd(c.amountCents) : null;
  switch (c.kind) {
    case 'higher_deposit':
      return amount ? t('decision:conditions.higherDepositAmount', { amount }) : t('decision:conditions.higher_deposit');
    case 'higher_rent':
      return amount ? t('decision:conditions.higherRentAmount', { amount }) : t('decision:conditions.higher_rent');
    case 'cosigner':
      return t('decision:conditions.cosigner');
  }
}

function partyBlock(p: LetterParty): SafeHtml {
  return html`<p class="party">${p.name}${p.address ? html`<br>${multiline(p.address)}` : ''}${p.phone ? html`<br>${p.phone}` : ''}</p>`;
}

function list(items: readonly string[]): SafeHtml {
  return html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
}

function reasonsBlock(input: LetterInput): SafeHtml | '' {
  const reasons = input.reasons.map(letterReason);
  const showNote = reasons.length === 0 && input.note?.trim();
  if (!reasons.length && !showNote) return '';
  const label = t('decision:letters.reasonLabel');
  if (showNote) return html`<p><strong>${label}</strong> ${input.note!.trim()}</p>`;
  if (reasons.length === 1) return html`<p><strong>${label}</strong> ${reasons[0]}.</p>`;
  return html`<p><strong>${t('decision:letters.reasonsLabel')}</strong></p>${list(reasons)}`;
}

function scoreBlock(data: LetterData): SafeHtml | '' {
  const s = data.scoreBlock;
  if (!s) return '';
  const rows: SafeHtml[] = [];
  if (s.noScore || s.score == null) rows.push(html`<p>${t('decision:letters.score.none')}</p>`);
  else {
    rows.push(html`<p>${t('decision:letters.score.value', { score: s.score })}${s.range ? ` ${t('decision:letters.score.range', { range: s.range })}` : ''}</p>`);
    if (s.date) rows.push(html`<p>${t('decision:letters.score.date', { date: date(s.date) })}</p>`);
    if (s.model) rows.push(html`<p>${t('decision:letters.score.model', { model: s.model })}</p>`);
  }
  if (s.keyFactors.length) rows.push(html`<p>${t('decision:letters.score.factors')}</p>${list(s.keyFactors)}`);
  return section(t('decision:letters.score.heading'), rows);
}

/** The FCRA block (company + required lines). Always present on an adverse action notice. */
function fcraBlock(data: LetterData): SafeHtml | '' {
  if (!data.fcraLines.length) return '';
  const c = data.company;
  return section(
    t('decision:letters.fcraHeading'),
    html`<p>${t('decision:letters.fcraIntro')}</p>${
      c ? html`<p class="party"><strong>${c.name}</strong><br>${multiline(c.address)}<br>${c.phone}</p>` : ''
    }${data.fcraLines.map((l) => html`<p>${l}</p>`)}`,
  );
}

/** Full letter HTML for expo-print. */
export function letterHtml(input: LetterInput): string {
  const title = letterTitle(input.kind);
  const respond = input.data.respondBy && input.respondByText
    ? html`<p><strong>${t('decision:letters.replyBy', { when: input.respondByText })}</strong></p>`
    : '';
  const body = html`<p>${input.dateText}</p>
${partyBlock(input.recipient)}
<p><strong>${t('decision:letters.re', { address: input.rentalAddress })}</strong></p>
<p>${t('decision:letters.dear', { name: input.recipient.name })}</p>
<p>${multiline(input.opening)}</p>
${input.conditions.length ? html`<p><strong>${t('decision:letters.conditionsLabel')}</strong></p>${list(input.conditions.map(conditionText))}` : ''}
${input.kind === 'adverse_action' || input.kind === 'denial' ? reasonsBlock(input) : ''}
${respond}
${scoreBlock(input.data)}
${fcraBlock(input.data)}
${input.closing.trim() ? html`<p>${multiline(input.closing)}</p>` : ''}
<p>${t('decision:letters.signOff')}<br>${input.landlord.name}${input.landlord.address ? html`<br>${multiline(input.landlord.address)}` : ''}${
    input.landlord.phone ? html`<br>${input.landlord.phone}` : ''
  }</p>`;
  return pdfDocument({ title, subtitle: input.recipient.name, body });
}

/** "Adverse action notice - letter 12 - 2026-11-27" (.pdf added by safeFileName): never the applicant's name (B-49). */
export function letterFileName(kind: LetterKind, letterId: number, at?: Date): string {
  return refFileName(letterTitle(kind), { kind: 'letter', id: letterId }, at);
}
