/**
 * S-20 Move-in checklist (F-16), pure part: default rooms from the rental, edits, signatures, export gate.
 * Rule (product.md silent, chosen here): a signature covers the checklist as it was signed — any content edit after a
 * signature clears both signatures (the screen asks "Editing clears both signatures. Continue?").
 */
import type { ItemCondition, MeterReadings, MoveInItem, MoveInRoom, MoveInSignatures } from '@/db/model';
import { t } from '@/i18n';

export type SignatureRole = 'landlord' | 'tenant';
export type MeterKind = keyof MeterReadings;
export const METER_KINDS: readonly MeterKind[] = ['electric', 'gas', 'water'];
export const CONDITIONS: readonly ItemCondition[] = ['good', 'fair', 'damaged'];
export const NAME_MAX = 40;
export const KEYS_MAX = 99;

export interface MoveInDraft {
  rooms: MoveInRoom[];
  meters: MeterReadings;
  keys: number | null;
  alarmsTested: boolean | null;
  signatures: MoveInSignatures;
}

type ItemKey = 'walls' | 'floors' | 'windows' | 'doors' | 'lights' | 'appliances' | 'cabinets' | 'sink' | 'toilet' | 'tub' | 'closet';
const item = (k: ItemKey): MoveInItem => ({ name: t(`system:s20.items.${k}`) });
const BASE: ItemKey[] = ['walls', 'floors', 'windows', 'doors', 'lights'];

/** Entry, Living room, Kitchen, Bedroom 1…n, Bathroom 1…n (+ Half bath for x.5). Studio (0 bd) has no bedroom rows. */
export function defaultRooms(bedrooms: number | null, bathrooms: number | null): MoveInRoom[] {
  const rooms: MoveInRoom[] = [
    { name: t('system:s20.rooms.entry'), items: (['walls', 'floors', 'doors', 'lights', 'closet'] as ItemKey[]).map(item) },
    { name: t('system:s20.rooms.living'), items: BASE.map(item) },
    { name: t('system:s20.rooms.kitchen'), items: [...BASE, 'appliances', 'cabinets', 'sink'].map((k) => item(k as ItemKey)) },
  ];
  const bd = Math.max(0, Math.floor(bedrooms ?? 0));
  for (let n = 1; n <= bd; n++) rooms.push({ name: t('system:s20.rooms.bedroom', { n }), items: [...BASE, 'closet'].map((k) => item(k as ItemKey)) });
  const ba = Math.max(0, bathrooms ?? 1);
  const full = Math.floor(ba);
  const bathItems: ItemKey[] = ['walls', 'floors', 'doors', 'lights', 'sink', 'toilet', 'tub'];
  for (let n = 1; n <= full; n++) rooms.push({ name: t('system:s20.rooms.bathroom', { n }), items: bathItems.map(item) });
  if (ba - full >= 0.5) rooms.push({ name: t('system:s20.rooms.halfBath'), items: (['walls', 'floors', 'lights', 'sink', 'toilet'] as ItemKey[]).map(item) });
  return rooms;
}

export function newDraft(bedrooms: number | null, bathrooms: number | null): MoveInDraft {
  return { rooms: defaultRooms(bedrooms, bathrooms), meters: {}, keys: null, alarmsTested: null, signatures: {} };
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

export type MoveInEdit =
  | { type: 'addRoom'; name: string }
  | { type: 'renameRoom'; room: number; name: string }
  | { type: 'removeRoom'; room: number }
  | { type: 'addItem'; room: number; name: string }
  | { type: 'removeItem'; room: number; item: number }
  /** Tapping the selected condition again clears it. */
  | { type: 'setCondition'; room: number; item: number; condition: ItemCondition }
  | { type: 'setNote'; room: number; item: number; note: string }
  | { type: 'addPhoto'; room: number; item: number; path: string }
  | { type: 'removePhoto'; room: number; item: number; path: string }
  | { type: 'setMeter'; meter: MeterKind; value: string }
  | { type: 'setKeys'; keys: number | null }
  | { type: 'setAlarms'; tested: boolean | null };

export const hasSignature = (d: MoveInDraft) => !!(d.signatures.landlord || d.signatures.tenant);
export const bothSigned = (d: MoveInDraft) => !!(d.signatures.landlord && d.signatures.tenant);
/** "Export PDF" / "Share" need both signatures ("Both signatures needed to export"). */
export const canExport = bothSigned;

const mapItem = (d: MoveInDraft, r: number, i: number, f: (it: MoveInItem) => MoveInItem): MoveInRoom[] =>
  d.rooms.map((room, ri) => (ri !== r ? room : { ...room, items: room.items.map((it, ii) => (ii === i ? f(it) : it)) }));

function apply(d: MoveInDraft, e: MoveInEdit): MoveInDraft {
  switch (e.type) {
    case 'addRoom':
      return { ...d, rooms: [...d.rooms, { name: e.name.trim(), items: BASE.map(item) }] };
    case 'renameRoom':
      return { ...d, rooms: d.rooms.map((r, i) => (i === e.room ? { ...r, name: e.name.trim() } : r)) };
    case 'removeRoom':
      return { ...d, rooms: d.rooms.filter((_, i) => i !== e.room) };
    case 'addItem':
      return { ...d, rooms: d.rooms.map((r, i) => (i === e.room ? { ...r, items: [...r.items, { name: e.name.trim() }] } : r)) };
    case 'removeItem':
      return { ...d, rooms: d.rooms.map((r, i) => (i === e.room ? { ...r, items: r.items.filter((_, j) => j !== e.item) } : r)) };
    case 'setCondition':
      return { ...d, rooms: mapItem(d, e.room, e.item, (it) => ({ ...it, condition: it.condition === e.condition ? undefined : e.condition })) };
    case 'setNote':
      return { ...d, rooms: mapItem(d, e.room, e.item, (it) => ({ ...it, note: e.note })) };
    case 'addPhoto':
      return { ...d, rooms: mapItem(d, e.room, e.item, (it) => ({ ...it, photoPaths: [...(it.photoPaths ?? []), e.path] })) };
    case 'removePhoto':
      return { ...d, rooms: mapItem(d, e.room, e.item, (it) => ({ ...it, photoPaths: (it.photoPaths ?? []).filter((p) => p !== e.path) })) };
    case 'setMeter':
      return { ...d, meters: { ...d.meters, [e.meter]: e.value.trim() } };
    case 'setKeys':
      return { ...d, keys: e.keys };
    case 'setAlarms':
      return { ...d, alarmsTested: e.tested };
  }
}

/** Files no longer referenced after an edit (removed photos / rooms, cleared signatures) — the caller deletes them. */
export function droppedFiles(before: MoveInDraft, after: MoveInDraft): string[] {
  const paths = (d: MoveInDraft) =>
    new Set([
      ...d.rooms.flatMap((r) => r.items.flatMap((i) => i.photoPaths ?? [])),
      ...[d.signatures.landlord?.path, d.signatures.tenant?.path].filter((p): p is string => !!p),
    ]);
  const keep = paths(after);
  return [...paths(before)].filter((p) => !keep.has(p));
}

/** Applies an edit; a content change clears both signatures (see top). */
export function editMoveIn(d: MoveInDraft, e: MoveInEdit): { draft: MoveInDraft; clearedSignatures: boolean } {
  const next = apply(d, e);
  if (!hasSignature(d) || next === d) return { draft: next, clearedSignatures: false };
  return { draft: { ...next, signatures: {} }, clearedSignatures: true };
}

export function sign(d: MoveInDraft, role: SignatureRole, path: string, at: string): MoveInDraft {
  return { ...d, signatures: { ...d.signatures, [role]: { path, at } } };
}

export function clearSignature(d: MoveInDraft, role: SignatureRole): MoveInDraft {
  return { ...d, signatures: { ...d.signatures, [role]: null } };
}

// ---------------------------------------------------------------------------
// Validation + progress
// ---------------------------------------------------------------------------

/** Room name error text, or null. `except` = the room being renamed. */
export function roomNameError(name: string, rooms: readonly MoveInRoom[], except?: number): string | null {
  const n = name.trim();
  if (!n) return t('system:s20.errors.roomName');
  if (n.length > NAME_MAX) return t('system:s20.errors.nameLong', { max: NAME_MAX });
  if (rooms.some((r, i) => i !== except && r.name.trim().toLowerCase() === n.toLowerCase())) return t('system:s20.errors.roomExists');
  return null;
}

export function itemNameError(name: string): string | null {
  const n = name.trim();
  if (!n) return t('system:s20.errors.itemName');
  if (n.length > NAME_MAX) return t('system:s20.errors.nameLong', { max: NAME_MAX });
  return null;
}

/** Keys field: '' → null; 0–99 whole number; else an error. */
export function parseKeys(text: string): { value: number | null; error: string | null } {
  const s = text.trim();
  if (!s) return { value: null, error: null };
  if (!/^\d{1,2}$/.test(s)) return { value: null, error: t('system:s20.errors.keys') };
  return { value: Number(s), error: null };
}

export const clampKeys = (n: number) => Math.max(0, Math.min(KEYS_MAX, Math.round(n)));

export interface MoveInProgress {
  items: number;
  rated: number;
  damaged: number;
  signed: { landlord: boolean; tenant: boolean };
}

export function moveInProgress(d: MoveInDraft): MoveInProgress {
  const all = d.rooms.flatMap((r) => r.items);
  return {
    items: all.length,
    rated: all.filter((i) => i.condition).length,
    damaged: all.filter((i) => i.condition === 'damaged').length,
    signed: { landlord: !!d.signatures.landlord, tenant: !!d.signatures.tenant },
  };
}

// ---------------------------------------------------------------------------
// Signature (strokes from the pad → SVG stored with files.saveText kind 'signature')
// ---------------------------------------------------------------------------

export type Stroke = readonly { x: number; y: number }[];

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Strokes in pad coordinates → a small black-on-transparent SVG (only numbers end up in the markup). */
export function strokesToSvg(strokes: readonly Stroke[], width: number, height: number): string {
  const paths = strokes
    .filter((s) => s.length > 0)
    .map((s) => {
      const pts = s.length === 1 ? [s[0], { x: s[0].x + 0.1, y: s[0].y }] : s;
      return `M${pts.map((p) => `${r1(p.x)} ${r1(p.y)}`).join('L')}`;
    });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r1(width)} ${r1(height)}" width="${r1(width)}" height="${r1(height)}"><path d="${paths.join(
    ' ',
  )}" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** A pad with fewer than 2 points in total is "not signed". */
export const isBlankSignature = (strokes: readonly Stroke[]) => strokes.reduce((n, s) => n + s.length, 0) < 2;
