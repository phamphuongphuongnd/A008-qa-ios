/** @jest-environment node */
import { clampOffset, DOUBLE_TAP_ZOOM, MAX_ZOOM, pinchTo, zoomAt } from '../components/zoomMath';

const size = { w: 400, h: 800 };

describe('B-43 S-10 photo viewer zoom', () => {
  it('pinch keeps the photo point under the fingers, clamps 1×–5×', () => {
    const start = { s: 1, x: 0, y: 0 };
    const f = { fx: 100, fy: -200 };
    const z = pinchTo(start, f, f, 2, size);
    expect(z.s).toBe(2);
    // The point under the fingers (100, -200) is still under them: (p - t) / s stays the same.
    expect((f.fx - z.x) / z.s).toBeCloseTo(f.fx);
    expect((f.fy - z.y) / z.s).toBeCloseTo(f.fy);
    expect(pinchTo(start, f, f, 20, size).s).toBe(MAX_ZOOM);
    expect(pinchTo({ s: 2, x: 50, y: 0 }, f, f, 0.1, size)).toEqual({ s: 1, x: 0, y: 0 });
  });

  it('two fingers moving together drag the zoomed photo', () => {
    const z = pinchTo({ s: 2, x: 0, y: 0 }, { fx: 0, fy: 0 }, { fx: 30, fy: 40 }, 1, size);
    expect(z).toEqual({ s: 2, x: 30, y: 40 });
  });

  it('never shows an empty band: offset stays within (size × (s − 1)) / 2', () => {
    expect(clampOffset({ s: 2, x: 1000, y: -1000 }, size)).toEqual({ s: 2, x: 200, y: -400 });
    expect(clampOffset({ s: 1, x: 10, y: 10 }, size)).toEqual({ s: 1, x: 0, y: 0 });
  });

  it('double-tap zooms in around the tapped point', () => {
    const z = zoomAt({ fx: 40, fy: 80 }, DOUBLE_TAP_ZOOM, size);
    expect(z.s).toBe(DOUBLE_TAP_ZOOM);
    expect((40 - z.x) / z.s).toBeCloseTo(40);
    expect((80 - z.y) / z.s).toBeCloseTo(80);
  });
});
