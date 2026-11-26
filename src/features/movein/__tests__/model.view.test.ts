import { exportState, meterFields, moveInSubtitle, newDraft, sign, signaturePathToSvg, svgPathData } from '../model';

const fmt = (d: string) => `D(${d})`;

describe('S-20 screen helpers', () => {
  it('subtitle with and without a date / tenant', () => {
    expect(moveInSubtitle('Jordan Ellis', '2027-01-01', fmt)).toContain('Jordan Ellis');
    expect(moveInSubtitle('Jordan Ellis', '2027-01-01', fmt)).toContain('D(2027-01-01)');
    expect(moveInSubtitle('Jordan Ellis', null, fmt)).toBe('Jordan Ellis');
    expect(moveInSubtitle(null, null, fmt).length).toBeGreaterThan(0);
  });

  it('export needs both signatures', () => {
    let d = newDraft(2, 1);
    expect(exportState(d)).toMatchObject({ enabled: false });
    expect(exportState(d).hint).toBeTruthy();
    d = sign(sign(d, 'landlord', 'M0 0 L10 10', '2027-01-01T10:00:00Z'), 'tenant', 'M0 0 L5 5', '2027-01-01T10:01:00Z');
    expect(exportState(d)).toEqual({ enabled: true, hint: null });
  });

  it('gas meter only when it has a value or is added', () => {
    const d = newDraft(1, 1);
    expect(meterFields(d, false)).toEqual(['electric', 'water']);
    expect(meterFields(d, true)).toEqual(['electric', 'gas', 'water']);
    expect(meterFields({ ...d, meters: { ...d.meters, gas: '123' } }, false)).toContain('gas');
  });

  it('signature SVG round trip keeps only path commands', () => {
    const svg = signaturePathToSvg('M1 2 L3 4"/><script>', 300.04, 120);
    expect(svg).not.toContain('script');
    const back = svgPathData(svg)!;
    expect(back).toMatchObject({ width: 300, height: 120 });
    expect(back.d).toMatch(/^M1 2 L3 4/);
    expect(back.d).not.toMatch(/["<>/]/);
    expect(svgPathData(null)).toBeNull();
    expect(svgPathData('<svg></svg>')).toBeNull();
  });
});
