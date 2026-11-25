import i18n, { t } from '..';
import { namespaces, resources } from '../resources';

describe('i18n (English)', () => {
  it('is ready synchronously with every namespace', () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe('en');
    for (const ns of namespaces) expect(i18n.hasResourceBundle('en', ns)).toBe(true);
    expect(Object.keys(resources.en).sort()).toEqual([...namespaces].sort());
  });

  it('reads the default namespace and prefixed keys', () => {
    expect(t('tabs.rentals')).toBe('Rentals');
    expect(t('common:actions.save')).toBe('Save');
    expect(t('decision:s17.title')).toBe('Compare');
    expect(t('ui:status.mismatch')).toBe('Mismatch');
  });
});
