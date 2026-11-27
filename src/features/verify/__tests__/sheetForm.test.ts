import { sameForm } from '../common';
import { emptyReportForm } from '../report';

describe('B-45 useSheetForm: dirty = differs from the last saved form', () => {
  it('a repeated edit with the same values (late keyboard onChangeText after Save) is not a change', () => {
    const saved = { ...emptyReportForm(), companyName: 'TransUnion SmartMove', evictionsMode: 'none' as const };
    const afterLateEdit = { ...saved, ...{ companyName: 'TransUnion SmartMove' } };
    expect(sameForm(afterLateEdit, saved)).toBe(true);
  });
  it('a real change, nested ones included, is a change', () => {
    const saved = { ...emptyReportForm(), cases: [{ date: '2021', outcome: null }] };
    expect(sameForm({ ...saved, companyPhone: '8' }, saved)).toBe(false);
    expect(sameForm({ ...saved, cases: [{ date: '2021', outcome: 'dismissed' as const }] }, saved)).toBe(false);
    expect(sameForm({ ...saved, cases: [{ date: '2021', outcome: null }] }, saved)).toBe(true);
  });
});
