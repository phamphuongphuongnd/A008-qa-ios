/**
 * S-20 Move-in checklist PDF (F-16): property, tenant, move-in date, each room's items (condition + note + photo
 * count, optional thumbnails), meters, keys, alarms, both signatures. Uses the shared shell (escaping, Letter page,
 * "not legal advice" footer). Pure: images come in as data URIs (the caller reads the files).
 */
import type { MoveInRoom } from '@/db/model';
import type { MoveInDraft } from '@/features/movein/model';
import { t } from '@/i18n';

import { date, dateTime, html, pdfDocument, printToPdfAndShare, raw, refFileName, section, table, type PdfAdapter, type PdfShareResult, type SafeHtml } from './shell';

export interface MoveInPdfInput {
  /** "1428 Maple St, Unit B, Columbus, OH 43215". */
  address: string;
  tenantName: string | null;
  /** 'YYYY-MM-DD' or null. */
  handoverOn: string | null;
  draft: MoveInDraft;
  /** Signature SVG markup by role (read from the saved files). */
  signatureSvg: { landlord?: string | null; tenant?: string | null };
  /** Photo path → data URI; when given, thumbnails are printed under each room. */
  photos?: Record<string, string>;
  /** Landlord's name (S-21) under the landlord signature, if set. */
  landlordName?: string | null;
}

const CSS = `
.facts td { border: none; padding: 1pt 8pt 1pt 0; }
.thumbs { display: flex; flex-wrap: wrap; gap: 4pt; margin: 2pt 0 8pt; break-inside: avoid; }
.thumbs img { width: 1.4in; height: 1.05in; object-fit: cover; border: 1px solid #999; }
.sigs { display: flex; gap: 24pt; margin-top: 8pt; break-inside: avoid; }
.sig { flex: 1; border-top: 1px solid #000; padding-top: 3pt; }
.sig img { display: block; height: 0.8in; max-width: 100%; margin-bottom: 2pt; }
.damaged { font-weight: 700; }
`;

/** data: URI for an SVG (percent-encoded, so nothing in it can break out of the attribute). */
export const svgDataUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Only our own data:image URIs are printed (never a remote or file URL). */
const safeImage = (src: string | undefined | null): string | null => (src && /^data:image\/(jpeg|png|webp|svg\+xml)[;,]/.test(src) ? src : null);

function roomTable(room: MoveInRoom): SafeHtml {
  const rows = room.items.map((it) => {
    const condition = it.condition ? t(`system:s20.condition.${it.condition}`) : t('system:s20.notRated');
    const n = it.photoPaths?.length ?? 0;
    return [
      it.name,
      it.condition === 'damaged' ? html`<span class="damaged">${condition}</span>` : condition,
      it.note ?? '',
      n ? t('system:s20.pdf.photoCount', { count: n }) : '',
    ];
  });
  return table(
    [
      { header: t('system:s20.pdf.item'), width: '28%' },
      { header: t('system:s20.pdf.conditionCol'), width: '14%' },
      { header: t('system:s20.pdf.note') },
      { header: t('system:s20.pdf.photos'), width: '12%' },
    ],
    rows,
    room.name,
  );
}

function thumbs(room: MoveInRoom, photos: Record<string, string> | undefined): SafeHtml | '' {
  if (!photos) return '';
  const srcs = room.items.flatMap((i) => (i.photoPaths ?? []).map((p) => safeImage(photos[p]))).filter((s): s is string => !!s);
  if (!srcs.length) return '';
  return html`<div class="thumbs">${srcs.map((s) => html`<img src="${s}" alt="">`)}</div>`;
}

function signatureBlock(role: 'landlord' | 'tenant', input: MoveInPdfInput): SafeHtml {
  const sig = input.draft.signatures[role];
  const svg = input.signatureSvg[role];
  const src = sig && svg ? svgDataUri(svg) : null;
  const who = role === 'landlord' ? t('system:s20.landlord') : t('system:s20.tenant');
  const name = role === 'landlord' ? input.landlordName : input.tenantName;
  return html`<div class="sig">${src ? html`<img src="${src}" alt="">` : ''}<div><strong>${who}</strong>${name ? html` · ${name}` : ''}</div><div class="muted">${
    sig ? t('system:s20.pdf.signedOn', { date: dateTime(sig.at) }) : t('system:s20.notSigned')
  }</div></div>`;
}

export function moveInHtml(input: MoveInPdfInput): string {
  const d = input.draft;
  const meterRows = (['electric', 'gas', 'water'] as const)
    .filter((k) => d.meters[k])
    .map((k) => {
      const unit = t(`system:s20.meterUnit.${k}`);
      return [t(`system:s20.meter.${k}`), `${d.meters[k]}${unit ? ` ${unit}` : ''}`];
    });
  const alarms = d.alarmsTested == null ? t('system:s20.notChecked') : d.alarmsTested ? t('system:s20.yes') : t('system:s20.no');

  const body = html`<style>${raw(CSS)}</style>
<p>${t('system:s20.pdf.intro')}</p>
<table class="facts" role="presentation"><tbody>
<tr><td><strong>${t('system:s20.pdf.property')}</strong></td><td>${input.address}</td></tr>
<tr><td><strong>${t('system:s20.pdf.tenant')}</strong></td><td>${input.tenantName ?? t('system:s20.noTenant')}</td></tr>
<tr><td><strong>${t('system:s20.pdf.handover')}</strong></td><td>${input.handoverOn ? date(input.handoverOn) : ''}</td></tr>
</tbody></table>
${d.rooms.map((room) => html`${roomTable(room)}${thumbs(room, input.photos)}`)}
${section(
  t('system:s20.meters'),
  meterRows.length
    ? table([{ header: t('system:s20.meters') }, { header: t('system:s20.pdf.reading'), align: 'right' }], meterRows)
    : html`<p class="muted">—</p>`,
)}
<table class="facts" role="presentation"><tbody>
<tr><td><strong>${t('system:s20.keys')}</strong></td><td>${d.keys == null ? '—' : String(d.keys)}</td></tr>
<tr><td><strong>${t('system:s20.alarms')}</strong></td><td>${alarms}</td></tr>
</tbody></table>
${section(t('system:s20.signatures'), html`<div class="sigs">${signatureBlock('landlord', input)}${signatureBlock('tenant', input)}</div>`)}`;

  return pdfDocument({ title: t('system:s20.pdf.title'), subtitle: input.address, body });
}

/** "Move-in checklist - rental 3 - 2026-11-27" (.pdf added at print): type + rental id + date, never the tenant's name or the address (TC-123, B-49). */
export const moveInFileName = (rentalId: number, at?: Date) => refFileName(t('system:s20.pdf.title'), { kind: 'rental', id: rentalId }, at);

/** Print + share sheet. */
export function exportMoveInPdf(input: MoveInPdfInput, rentalId: number, adapter?: PdfAdapter, at?: Date): Promise<PdfShareResult> {
  return printToPdfAndShare(moveInHtml(input), moveInFileName(rentalId, at), { dialogTitle: t('system:s20.exportPdf'), adapter });
}
