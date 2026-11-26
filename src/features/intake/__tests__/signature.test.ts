import { hasInk, MIN_SIGNATURE_LENGTH, normalizeSignature, signatureSvg, validateSignature, type Stroke } from '../signature';

const pad = { width: 300, height: 120 };
const zigzag = (n: number, step = 12): Stroke => Array.from({ length: n }, (_, i) => ({ x: 10 + i * step, y: i % 2 ? 30 : 90 }));

describe('signature', () => {
  it('normalises to a 1000-wide integer path keeping the aspect ratio', () => {
    const s = normalizeSignature([[{ x: 0, y: 0 }, { x: 150, y: 60 }, { x: 300, y: 120 }]], pad);
    expect(s.width).toBe(1000);
    expect(s.height).toBe(400);
    expect(s.path).toBe('M0 0 L500 200 L1000 400');
    expect(s.points).toBe(3);
  });

  it('clamps points outside the pad, drops duplicates and non-finite values', () => {
    const s = normalizeSignature([[{ x: -20, y: 10 }, { x: -5, y: 10 }, { x: NaN, y: 1 }, { x: 400, y: 10 }]], pad);
    expect(s.path).toBe('M0 33 L1000 33');
    expect(s.points).toBe(2);
  });

  it('draws a single tap as a dot', () => {
    expect(normalizeSignature([[{ x: 30, y: 30 }]], pad).path).toBe('M100 100 L100 100');
  });

  it('refuses empty and too-short signatures', () => {
    expect(validateSignature(null)).toBe('signatureRequired');
    expect(validateSignature({ kind: 'drawn', strokes: [], pad })).toBe('signatureRequired');
    expect(validateSignature({ kind: 'drawn', strokes: [[]], pad })).toBe('signatureRequired');
    expect(validateSignature({ kind: 'drawn', strokes: [[{ x: 10, y: 10 }]], pad })).toBe('signatureTooShort');
    // Long enough ink but too few points (a single straight line).
    expect(validateSignature({ kind: 'drawn', strokes: [[{ x: 0, y: 50 }, { x: 300, y: 50 }]], pad })).toBe('signatureTooShort');
    // Many points but tiny ink.
    const scribble: Stroke = Array.from({ length: 10 }, (_, i) => ({ x: 10 + i, y: 10 + (i % 2) }));
    expect(validateSignature({ kind: 'drawn', strokes: [scribble], pad })).toBe('signatureTooShort');
    expect(validateSignature({ kind: 'drawn', strokes: [zigzag(12)], pad })).toBeNull();
    expect(normalizeSignature([zigzag(12)], pad).length).toBeGreaterThanOrEqual(MIN_SIGNATURE_LENGTH);
  });

  it('accepts a typed name of 2+ letters (a11y fallback)', () => {
    expect(validateSignature({ kind: 'typed', name: '  ' })).toBe('signatureRequired');
    expect(validateSignature({ kind: 'typed', name: 'J.' })).toBe('signatureTooShort');
    expect(validateSignature({ kind: 'typed', name: 'Jo' })).toBeNull();
  });

  it('builds a standalone SVG, escaping a typed name', () => {
    const drawn = signatureSvg({ kind: 'drawn', strokes: [zigzag(12)], pad });
    expect(drawn).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 1000 400"/);
    expect(drawn).toContain('<path d="M33 300 L');
    const typed = signatureSvg({ kind: 'typed', name: 'Jo <b>&' });
    expect(typed).toContain('Jo &lt;b&gt;&amp;');
    expect(typed).not.toContain('<b>');
  });

  it('knows when there is ink to clear', () => {
    expect(hasInk(null)).toBe(false);
    expect(hasInk({ kind: 'drawn', strokes: [[]], pad })).toBe(false);
    expect(hasInk({ kind: 'drawn', strokes: [[{ x: 1, y: 1 }]], pad })).toBe(true);
    expect(hasInk({ kind: 'typed', name: 'a' })).toBe(true);
  });
});
