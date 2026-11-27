/**
 * Text-size thresholds. Android reports its system steps as floats (1.3f → 1.2999999523…), so a plain `>= 1.3`
 * misses the 130 % step itself (B-69). Compare with a small tolerance, well below the gap between real steps
 * (0.85 · 1.0 · 1.1 · 1.15 · 1.3 · 1.5 · 1.8 · 2.0).
 */
const FONT_SCALE_EPSILON = 0.005;

/** From 130 % text S-17 shows one card per applicant (product.md §5 S-17). */
export const COMPARE_CARDS_FONT_SCALE = 1.3;

export function fontScaleAtLeast(scale: number, threshold: number): boolean {
  return scale >= threshold - FONT_SCALE_EPSILON;
}
