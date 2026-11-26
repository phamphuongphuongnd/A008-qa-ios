/** One stroke = points in pad coordinates. */
export type SignatureStroke = { x: number; y: number }[];

/** Strokes → one SVG path ("M x y L x y …"), coordinates rounded to 0.5 px. Store this string (or render it into the PDF). */
export function strokesToPath(strokes: readonly SignatureStroke[]): string {
  const r = (n: number) => Math.round(n * 2) / 2;
  return strokes
    .filter((s) => s.length > 0)
    .map((s) => {
      const [first, ...rest] = s;
      // A tap leaves a dot.
      const tail = rest.length ? rest.map((p) => `L${r(p.x)} ${r(p.y)}`).join('') : `L${r(first!.x) + 0.5} ${r(first!.y)}`;
      return `M${r(first!.x)} ${r(first!.y)}${tail}`;
    })
    .join('');
}
