/**
 * S-17 table geometry (B-46, B-71). Columns have one fixed width per text size so the column list can be virtualised
 * with `getItemLayout` (no measuring 20 columns before the first frame) and still fit the widest badge.
 */

/** Pinned criteria column at 100 % text (mockup). Label text area = width − 12 left − 8 right padding. */
export const COMPARE_PIN_WIDTH = 104;
const PIN_PADDING = 20;

/**
 * Pinned criteria column grows with the text size (B-146): at 115 % the fixed 104 dp broke one-word labels mid-word
 * ("Document/s", "Backgroun/d"). The label text area scales like the text, so a word that fits at 100 % fits at every
 * step below 130 % (130 % and up = cards).
 */
export function comparePinWidth(fontScale: number): number {
  return Math.max(COMPARE_PIN_WIDTH, Math.ceil((COMPARE_PIN_WIDTH - PIN_PADDING) * fontScale + PIN_PADDING));
}
/** Header and row heights: fixed so the pinned column and the scrolling columns line up. */
export const COMPARE_HEADER_HEIGHT = 60;
export const COMPARE_ROW_HEIGHT = 72;

/**
 * Widest cell content is the "Needs review" badge: 6 + 9 padding, 14 icon, 4 gap (fixed) + ~80 dp of 12 px
 * semibold text (scales with the font), inside 8 + 8 cell padding. 136 dp at 100 %, 160 at 129 % (130 % = cards).
 */
export function compareColumnWidth(fontScale: number): number {
  return Math.max(120, Math.ceil(56 + 80 * fontScale));
}

/** Columns mounted around the visible ones: a phone shows ~2, so the first paint mounts 3–4 of 20, not all. */
export const COMPARE_WINDOW = { initialNumToRender: 3, maxToRenderPerBatch: 2, windowSize: 5 } as const;
