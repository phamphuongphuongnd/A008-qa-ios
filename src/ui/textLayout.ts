/**
 * Layout choices that depend on text size, kept pure for tests (fact expo-device-bugs-checklist: pick the layout from
 * (width, fontScale), never from how long a text happens to be).
 */

/** Android reports 1.3f as 1.2999999 (B-69): compare scales with a small tolerance. */
export const atLeastScale = (fontScale: number, min: number) => fontScale >= min - 0.005;

/**
 * KeyValue: at 150 % text and up the value goes under its label (full width) — side by side, a long label squeezed a
 * short value until it broke mid-word ("N / o", B-74a). Below that the value keeps its own width (up to 60 %).
 */
export function keyValueStacked(fontScale: number): boolean {
  return atLeastScale(fontScale, 1.5);
}
