import fs from 'fs';
import path from 'path';

import { GUIDE, getArticle } from '../articles';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** product.md S-25 "other screens link straight to the article": screen file → the GUIDE key it links with GuideLink. */
const LINKS: [screen: string, file: string, key: keyof typeof GUIDE][] = [
  ['S-03 WA hint', 'src/features/units/screens/RentalEditorScreen.tsx', 'firstCome'],
  ['S-04 C1 voucher', 'src/features/criteria/components/CriterionCard.tsx', 'vouchers'],
  ['S-10', 'src/features/intake/screens/DocumentsScreen.tsx', 'verifyingIncome'],
  ['S-11', 'src/features/verify/screens/LandlordReferenceScreen.tsx', 'fakeReferences'],
  ['S-12', 'src/features/verify/screens/EmployerReferenceScreen.tsx', 'fakeReferences'],
  ['S-13', 'src/features/verify/screens/ScreeningReportScreen.tsx', 'screeningReports'],
  ['S-15 FCRA', 'src/features/decision/screens/DecisionScreen.tsx', 'adverseAction'],
  ['S-16 FCRA', 'src/features/decision/screens/LetterScreen.tsx', 'adverseAction'],
  ['S-17', 'src/features/decision/screens/CompareScreen.tsx', 'firstCome'],
  ['S-18', 'src/features/decision/screens/OrderQueueScreen.tsx', 'firstCome'],
  ['S-24', 'src/features/settings/screens/DataCleanupScreen.tsx', 'disposingData'],
];

describe('context links to Guide articles', () => {
  it.each(LINKS)('%s links its article', (_screen, file, key) => {
    expect(read(file)).toContain(`<GuideLink slug={GUIDE.${key}} />`);
    expect(getArticle(GUIDE[key])?.title).toBeTruthy();
  });
});
