import { strokesToPath } from '../signaturePath';

describe('signature path', () => {
  it('joins strokes into one SVG path, rounded to 0.5 px', () => {
    expect(
      strokesToPath([
        [
          { x: 1.26, y: 2 },
          { x: 3, y: 4.74 },
        ],
        [{ x: 10, y: 10 }],
      ]),
    ).toBe('M1.5 2L3 4.5M10 10L10.5 10');
    expect(strokesToPath([])).toBe('');
    expect(strokesToPath([[]])).toBe('');
  });
});
