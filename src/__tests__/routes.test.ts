import { parseId, routes } from '../routes';

describe('routes', () => {
  it('builds paths with ids and optional query values', () => {
    expect(routes.rentalHub(3)).toBe('/units/3');
    expect(routes.criteria(3)).toBe('/units/3/criteria');
    expect(routes.criteria(3, { setup: true })).toBe('/units/3/criteria?setup=1');
    expect(routes.applicationEdit(7)).toBe('/applicants/7/form');
    expect(routes.applicationEdit(7, 4)).toBe('/applicants/7/form?section=4');
    expect(routes.letter(7, { kind: 'adverse_action' })).toBe('/review/applicant/7/letter?kind=adverse_action');
    expect(routes.moveIn(1, 2)).toBe('/move-in/1?applicantId=2');
    expect(routes.guideArticle('first come rules')).toBe('/guide/first%20come%20rules');
  });

  it('parses row ids from params', () => {
    expect(parseId('12')).toBe(12);
    expect(parseId(['5', '6'])).toBe(5);
    expect(parseId('new')).toBeNull();
    expect(parseId('0')).toBeNull();
    expect(parseId('1e3')).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });
});
