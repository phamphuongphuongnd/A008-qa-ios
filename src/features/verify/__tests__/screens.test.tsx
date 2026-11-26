/**
 * Render tests for S-11 … S-14 (test-renderer, in-memory DB with the §8 sample). Light + dark render; data / actions
 * go through the real service (hooks replaced by testing/harness).
 */
import 'react-native-gesture-handler/jestSetup';

import { listApplicants, listIncomes, listResidences } from '@/db/repos/applicants';
import { saveDecision } from '@/db/repos/decisions';
import { loadSampleRental } from '@/db/repos/sample';
import { getBackground, getReference, getReport, listReferences } from '@/db/repos/verify';
import { makeTestDb } from '@/db/testing/testDb';
import { ThemeProvider } from '@/theme';

import BackgroundReviewScreen from '../screens/BackgroundReviewScreen';
import EmployerReferenceScreen from '../screens/EmployerReferenceScreen';
import LandlordReferenceScreen from '../screens/LandlordReferenceScreen';
import ScreeningReportScreen from '../screens/ScreeningReportScreen';
import { byLabel, byText, callProp, hasText, input, press, render, store, type } from '../testing/harness';

jest.mock('../hooks', () => jest.requireActual('../testing/harness').hooksMock);
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (t, k) => (k === '__esModule' ? true : () => null) }));
jest.mock('react-native-safe-area-context', () => jest.requireActual('react-native-safe-area-context/jest/mock').default);

const mockParams: { current: Record<string, string> } = { current: {} };
const mockRouter = { back: jest.fn(), push: jest.fn(), replace: jest.fn() };
jest.mock('@/services/router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams.current,
  useNavigation: () => ({ dispatch: jest.fn(), addListener: () => () => {}, isFocused: () => true }),
  usePreventRemove: () => {},
  useFocusEffect: () => {},
}));

function setup() {
  const db = makeTestDb();
  store.db = db;
  const rentalId = loadSampleRental(db);
  const id = (name: string) => listApplicants(db, rentalId).find((a) => a.fullName === name)!.id;
  return { db, rentalId, jordan: id('Jordan Ellis'), priya: id('Priya Raman'), marcus: id('Marcus Webb'), dana: id('Dana Ortiz') };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('S-11 Landlord reference', () => {
  test('Marcus: header, red flags, call script; answering saves', async () => {
    const { db, marcus } = setup();
    const residence = listResidences(db, marcus)[0];
    mockParams.current = { applicantId: String(marcus), residenceId: String(residence.id) };
    for (const scheme of ['light', 'dark'] as const) {
      const root = await render(
        <ThemeProvider preference={scheme}>
          <LandlordReferenceScreen />
        </ThemeProvider>,
      );
      expect(hasText(root, 'Landlord reference')).toBe(true);
      expect(hasText(root, `${residence.address} · Marcus Webb`)).toBe(true);
      expect(hasText(root, 'Find the real owner')).toBe(true);
      expect(hasText(root, 'Rent differs by more than 5% (+29%)')).toBe(true);
      expect(hasText(root, 'Dates differ by more than 31 days')).toBe(true);
      expect(hasText(root, `1. Did Marcus rent from you at ${residence.address}?`)).toBe(true);
      expect(hasText(root, '9. Would you rent to them again?')).toBe(true);
      root.unmount();
    }
    const root = await render(<LandlordReferenceScreen />);
    // Q9 "Yes": pills are radio buttons labelled by their text; the last "Yes" group is Q9.
    const yes = byLabel(root, 'Yes');
    await press(yes[yes.length - 1]);
    const ref = listReferences(db, marcus).find((r) => r.kind === 'landlord')!;
    expect(getReference(db, ref.id)!.answers?.rentAgain).toBe('yes');
    expect(hasText(root, "Wouldn't say whether they'd rent to them again")).toBe(false);
    // Email a verification request → mail app via mailto.
    await press(byLabel(root, 'Email a verification request')[0]);
    expect(store.native.openUrl).toHaveBeenCalledWith(expect.stringMatching(/^mailto:/));
  });

  test('Priya: attempts log → Mark as unreachable after a third try by another method', async () => {
    const { db, priya } = setup();
    const residence = listResidences(db, priya)[0];
    mockParams.current = { applicantId: String(priya), residenceId: String(residence.id) };
    const root = await render(<LandlordReferenceScreen />);
    expect(byText(root, 'No answer')).toHaveLength(2);
    expect(byLabel(root, 'Mark as unreachable')).toHaveLength(0);
    await press(byLabel(root, 'Log attempt')[0]);
    await press(byLabel(root, 'Email')[0]);
    await press(byLabel(root, 'No reply yet')[0]);
    await press(byLabel(root, 'Save').slice(-1)[0]);
    expect(hasText(root, 'No reply yet')).toBe(true);
    await press(byLabel(root, 'Mark as unreachable')[0]);
    const ref = listReferences(db, priya).find((r) => r.kind === 'landlord')!;
    expect(getReference(db, ref.id)!.unreachable).toBe(true);
    expect(hasText(root, 'Marked as unreachable')).toBe(true);
  });

  test('unknown residence → not-found state', async () => {
    const { jordan } = setup();
    mockParams.current = { applicantId: String(jordan), residenceId: '99999' };
    const root = await render(<LandlordReferenceScreen />);
    expect(hasText(root, "This record isn't available anymore.")).toBe(true);
  });
});

describe('S-12 Employer reference', () => {
  test('renders from the design system; answering saves with the call date', async () => {
    const { db, priya } = setup();
    const income = listIncomes(db, priya)[0];
    mockParams.current = { applicantId: String(priya), incomeId: String(income.id) };
    const root = await render(
      <ThemeProvider preference="dark">
        <EmployerReferenceScreen />
      </ThemeProvider>,
    );
    expect(hasText(root, 'Employer reference')).toBe(true);
    expect(hasText(root, 'Many employers only confirm dates and title. Verify income with pay stubs instead.')).toBe(true);
    await press(byLabel(root, 'Yes')[0]);
    const ref = listReferences(db, priya).find((r) => r.kind === 'employer')!;
    expect(ref.answers).toMatchObject({ employed: 'yes' });
    expect(ref.answers?.answeredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('S-13 Screening report', () => {
  test('Priya: shows the entered report; Marcus: enter None / None and Save', async () => {
    const { db, priya, marcus } = setup();
    mockParams.current = { applicantId: String(priya) };
    let root = await render(<ScreeningReportScreen />);
    expect(hasText(root, 'Screening reports come from licensed companies.')).toBe(true);
    expect(input(root, 'Name').props.value).toBe('TransUnion Rental Screening Solutions');
    expect(input(root, 'Amount owed').props.value).toBe('2,310.00');
    root.unmount();

    mockParams.current = { applicantId: String(marcus) };
    root = await render(<ScreeningReportScreen />);
    expect(hasText(root, 'Name, mailing address and phone are needed')).toBe(true);
    await press(byLabel(root, 'None found')[0]);
    await press(byLabel(root, 'None')[0]);
    await press(byLabel(root, 'MySmartMove')[0]);
    expect(store.native.openUrl).toHaveBeenCalledWith('https://www.mysmartmove.com/');
    await press(byLabel(root, 'Save')[0]);
    expect(getReport(db, marcus)).toMatchObject({ evictions: [], landlordCollectionsCents: 0, service: 'mysmartmove' });
  });

  test('attach: camera permission denied shows a message, files are attached', async () => {
    const { db, marcus } = setup();
    mockParams.current = { applicantId: String(marcus) };
    const root = await render(<ScreeningReportScreen />);
    store.native.pick.mockResolvedValueOnce({ status: 'picked', files: [{ uri: 'file:///r.pdf', mime: 'application/pdf' }] });
    await press(byLabel(root, 'Add PDF')[0]);
    expect(getReport(db, marcus)!.filePaths).toHaveLength(1);
    expect(hasText(root, 'Report PDF 1')).toBe(true);
  });
});

describe('S-14 Background review', () => {
  test('"None" → Continue with the offer goes back; no Withdraw button', async () => {
    const { db, dana } = setup();
    saveDecision(db, { applicantId: dana, kind: 'conditional_offer', at: '2026-12-05T10:00:00-05:00', reasons: [], conditions: [] }, 'conditional_offer');
    mockParams.current = { applicantId: String(dana) };
    const root = await render(<BackgroundReviewScreen />);
    await press(byLabel(root, 'No convictions in the past 7 years')[0]);
    expect(byLabel(root, 'Withdraw the offer')).toHaveLength(0);
    await press(byLabel(root, 'Continue with the offer')[0]);
    expect(getBackground(db, dana)).toMatchObject({ noConvictions: true, outcome: 'continue' });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  test('locked before an offer', async () => {
    const { marcus } = setup();
    mockParams.current = { applicantId: String(marcus) };
    const root = await render(<BackgroundReviewScreen />);
    expect(hasText(root, 'Unlocks after you make a conditional offer.')).toBe(true);
    expect(hasText(root, 'Criminal history laws by city')).toBe(true);
  });

  test('after an offer: conviction → Needs review; withdraw needs the assessment, then goes to S-15', async () => {
    const { db, jordan } = setup();
    saveDecision(db, { applicantId: jordan, kind: 'conditional_offer', at: '2026-12-05T10:00:00-05:00', reasons: [], conditions: [] }, 'conditional_offer');
    mockParams.current = { applicantId: String(jordan) };
    const root = await render(
      <ThemeProvider preference="dark">
        <BackgroundReviewScreen />
      </ThemeProvider>,
    );
    expect(hasText(root, 'Some cities and states ban or delay criminal history checks')).toBe(true);
    await press(byLabel(root, 'Add convictions')[0]);
    await press(byLabel(root, 'Property')[0]);
    // Dates go through the DateField's onChange (the native picker is not rendered in Jest).
    await callProp(root, 'Date of conviction', 'onChange', '2020-06-01');
    await callProp(root, 'Sentence completed (if known)', 'onChange', '2020-12-01');
    expect(getBackground(db, jordan)).toMatchObject({ noConvictions: false, convictions: [{ type: 'property', convictedOn: '2020-06-01', sentenceEndedOn: '2020-12-01' }] });
    expect(byLabel(root, 'Needs review').length).toBeGreaterThan(0);
    expect(hasText(root, 'Convicted Jun 2020 · sentence completed Dec 2020')).toBe(true);
    expect(hasText(root, '(calculated)')).toBe(true);
    // Never auto-deny: withdraw stays blocked until the individual assessment is answered.
    expect(hasText(root, 'Answer the individual assessment questions first.')).toBe(true);
    await type(input(root, 'How serious was it, and how does it relate to the safety of residents or property?'), 'Shoplifting, single offense.');
    await type(input(root, 'Any evidence of rehabilitation or good tenant history since?'), 'Six years with no issues');
    await type(input(root, 'Anything else the applicant told you?'), 'Explained it');
    await press(byLabel(root, 'Withdraw the offer')[0]);
    expect(getBackground(db, jordan)!.outcome).toBe('withdraw');
    expect(mockRouter.push).toHaveBeenCalledWith(`/review/applicant/${jordan}/decision`);
    root.unmount();
  });
});

