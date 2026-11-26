/**
 * Signature data (S-08 part 6, product.md F-05). The pad gives strokes in its own dp coordinates; we store one
 * normalised SVG path in a 1000-wide viewBox (integers, "M x y L x y …"), so the same signature prints the same in a
 * PDF and on any screen size. A11y fallback (mockup v2): "Type your name instead" → a typed signature.
 * An empty or too-short signature (a tap, a tiny tick) is refused.
 */
import { escapeHtml } from '@/pdf/shell';

export interface Point {
  x: number;
  y: number;
}
export type Stroke = readonly Point[];

export type SignatureInput =
  | { kind: 'drawn'; strokes: readonly Stroke[]; pad: { width: number; height: number } }
  | { kind: 'typed'; name: string };

export interface NormalizedSignature {
  /** Always SIGNATURE_WIDTH. */
  width: number;
  height: number;
  /** SVG path data; '' when there is nothing drawn. */
  path: string;
  /** Total ink length in viewBox units. */
  length: number;
  /** Distinct points kept. */
  points: number;
}

export const SIGNATURE_WIDTH = 1000;
/** Ink shorter than a quarter of the pad width is a tick, not a signature. */
export const MIN_SIGNATURE_LENGTH = 250;
export const MIN_SIGNATURE_POINTS = 8;
/** A typed signature needs at least 2 letters. */
export const MIN_TYPED_LETTERS = 2;

export type SignatureError = 'signatureRequired' | 'signatureTooShort';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Scale strokes from pad dp to the 1000-wide viewBox, round, drop repeated points; build the path. */
export function normalizeSignature(strokes: readonly Stroke[], pad: { width: number; height: number }): NormalizedSignature {
  const w = pad.width > 0 ? pad.width : 1;
  const h = pad.height > 0 ? pad.height : 1;
  const scale = SIGNATURE_WIDTH / w;
  const height = Math.max(1, Math.round(h * scale));
  const parts: string[] = [];
  let length = 0;
  let points = 0;
  for (const stroke of strokes) {
    const pts: Point[] = [];
    for (const p of stroke) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const q = { x: Math.round(clamp(p.x, 0, w) * scale), y: Math.round(clamp(p.y, 0, h) * scale) };
      const last = pts[pts.length - 1];
      if (!last || last.x !== q.x || last.y !== q.y) pts.push(q);
    }
    if (pts.length === 0) continue;
    points += pts.length;
    // A single point is drawn as a zero-length line (a dot with round caps).
    const line = pts.length === 1 ? [pts[0], pts[0]] : pts;
    parts.push(line.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' '));
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return { width: SIGNATURE_WIDTH, height, path: parts.join(' '), length: Math.round(length), points };
}

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;

/** null = acceptable. */
export function validateSignature(input: SignatureInput | null | undefined): SignatureError | null {
  if (!input) return 'signatureRequired';
  if (input.kind === 'typed') {
    const n = letters(input.name.trim());
    if (n === 0) return 'signatureRequired';
    return n < MIN_TYPED_LETTERS ? 'signatureTooShort' : null;
  }
  const s = normalizeSignature(input.strokes, input.pad);
  if (s.points === 0) return 'signatureRequired';
  return s.length < MIN_SIGNATURE_LENGTH || s.points < MIN_SIGNATURE_POINTS ? 'signatureTooShort' : null;
}

/** Standalone SVG file (stored as `signature-{applicantId}.svg`). Call after `validateSignature` passed. */
export function signatureSvg(input: SignatureInput): string {
  if (input.kind === 'typed') {
    const height = 250;
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIGNATURE_WIDTH} ${height}" width="${SIGNATURE_WIDTH}" height="${height}">` +
      `<text x="${SIGNATURE_WIDTH / 2}" y="160" text-anchor="middle" font-family="cursive, 'Brush Script MT', serif" ` +
      `font-style="italic" font-size="110" fill="#000">${escapeHtml(input.name.trim())}</text></svg>`
    );
  }
  const s = normalizeSignature(input.strokes, input.pad);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s.width} ${s.height}" width="${s.width}" height="${s.height}">` +
    `<path d="${s.path}" fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  );
}

/** True when the input has any ink / letters at all (enables "Clear"). */
export function hasInk(input: SignatureInput | null | undefined): boolean {
  if (!input) return false;
  return input.kind === 'typed' ? input.name.trim().length > 0 : input.strokes.some((s) => s.length > 0);
}
