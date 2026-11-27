/**
 * Zoom maths for the S-10 photo viewer (pure, tested). A view of size `w × h` shows the photo scaled by `s` about its
 * centre and moved by (`x`, `y`). Points are relative to the centre of the viewing area.
 */
export interface Zoom {
  s: number;
  x: number;
  y: number;
}
export interface Size {
  w: number;
  h: number;
}

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
export const DOUBLE_TAP_ZOOM = 2.5;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Keeps the photo covering the view: no empty band at an edge while zoomed; centred at 1×. */
export function clampOffset(z: Zoom, size: Size): Zoom {
  const s = clamp(z.s, MIN_ZOOM, MAX_ZOOM);
  const mx = (size.w * (s - 1)) / 2;
  const my = (size.h * (s - 1)) / 2;
  // `+ 0` turns -0 (clamping into [-0, 0] at 1×) into 0.
  return { s, x: clamp(z.x, -mx, mx) + 0, y: clamp(z.y, -my, my) + 0 };
}

/**
 * Pinch from `start` (zoom when the fingers went down, focal point `f0`) to scale factor `scale` with the focal point
 * now at `f`: the photo point that was under the fingers stays under them (so two fingers also drag).
 */
export function pinchTo(start: Zoom, f0: { fx: number; fy: number }, f: { fx: number; fy: number }, scale: number, size: Size): Zoom {
  const s = clamp(start.s * scale, MIN_ZOOM, MAX_ZOOM);
  const k = s / start.s;
  return clampOffset({ s, x: f.fx - (f0.fx - start.x) * k, y: f.fy - (f0.fy - start.y) * k }, size);
}

/** Double-tap at `f` from 1×: zoom to `s` with the tapped point staying put. */
export function zoomAt(f: { fx: number; fy: number }, s: number, size: Size): Zoom {
  return clampOffset({ s, x: f.fx * (1 - s), y: f.fy * (1 - s) }, size);
}
