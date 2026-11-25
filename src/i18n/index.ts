import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { defaultNS, namespaces, resources } from './resources';

/**
 * English only for v1 (i18n is wired so a language is just more JSON). Initialised synchronously at import, so
 * `t()` works in the first render and in tests. In components use `useTranslation('<ns>')`; outside React use `t`.
 * Keys from another namespace: `t('common:actions.save')`.
 */
const i18n = createInstance();
i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en'],
  ns: namespaces,
  defaultNS,
  resources,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const t = i18n.t.bind(i18n);
export default i18n;
