import { createApplicant, getApplicant, setApplicantStatus } from '@/db/repos/applicants';
import { listRentals, createRental, setRentalStatus } from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import { getSettings, updateSettings } from '@/db/repos/settings';
import { startTimer } from '@/db/repos/decisions';
import { makeTestDb, makeTestFiles } from '@/db/testing/testDb';
import { makeFakeNotifications } from '@/notifications/adapter';

import { cleanupConfirmTitle, cleanupRows, deleteEverything, deleteNotSelected, isDeleteConfirmed } from '../dataCleanup';

const NOW = new Date(2027, 1, 24, 12, 0);

function closedRentalWith3NotSelected() {
  const db = makeTestDb();
  loadSampleRental(db); // the sample never counts
  const rentalId = createRental(db, { street: '310 Oak Ct', city: 'Dayton', state: 'OH', zip: '45402', rentCents: 120000 });
  const ids = ['Ann Lee', 'Bo Park', 'Cy Diaz', 'Di Moss'].map((fullName, i) =>
    createApplicant(db, { rentalId, fullName, receivedAt: `2026-12-0${i + 1}T09:00:00.000-05:00`, source: 'landlord' }),
  );
  setApplicantStatus(db, ids[0], 'approved');
  setApplicantStatus(db, ids[1], 'denied');
  setRentalStatus(db, rentalId, 'closed', new Date(2027, 0, 10, 9, 0).toISOString());
  const files = makeTestFiles([`applicants/${ids[0]}/doc-1.jpg`, `applicants/${ids[1]}/doc-2.jpg`, `applicants/${ids[1]}/letter-3.pdf`]);
  return { db, files, rentalId, ids };
}

describe('S-24 Data cleanup', () => {
  it('lists closed rentals with not-selected applicants, with the mockup text', () => {
    const { db, rentalId, ids } = closedRentalWith3NotSelected();
    const rows = cleanupRows(db, 30, NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ rentalId, address: '310 Oak Ct', applicantIds: ids.slice(1), daysClosed: 45, due: true });
    expect(rows[0].label).toBe('3 applicants not selected · closed 45 days ago');
    expect(cleanupRows(db, 60, NOW)[0].due).toBe(false);
    expect(cleanupRows(db, null, NOW)[0].due).toBe(false);
    expect(cleanupConfirmTitle(3)).toBe('Permanently delete data for 3 applicants?');
    expect(cleanupConfirmTitle(1)).toBe('Permanently delete data for 1 applicant?');
  });

  it('"Delete their data" purges them (files too), keeps the approved tenant, cancels their timer notifications', async () => {
    const { db, files, rentalId, ids } = closedRentalWith3NotSelected();
    startTimer(db, { applicantId: ids[2], kind: 'offer', startedAt: 'a', endsAt: 'b', notificationIds: ['t-1', 't-2'] });
    const n = makeFakeNotifications();
    for (const id of ['t-1', 't-2', 'reminder-backup'])
      await n.adapter.schedule({ id, title: '', body: '', at: NOW, channel: 'timers', url: '/' });

    expect(await deleteNotSelected(db, files, rentalId, { notifications: n.adapter })).toBe(3);
    expect([...n.scheduled.keys()]).toEqual(['reminder-backup']);
    expect(getApplicant(db, ids[0])?.fullName).toBe('Ann Lee');
    for (const id of ids.slice(1)) {
      const a = getApplicant(db, id);
      expect(a?.fullName).toBe(''); // anonymous row for the Decision file
      expect(a?.deletedAt).not.toBeNull();
    }
    expect([...files.files]).toEqual([`applicants/${ids[0]}/doc-1.jpg`]);
    expect(cleanupRows(db, 30, NOW)).toEqual([]);
    expect(await deleteNotSelected(db, files, rentalId)).toBe(0);
  });
});

describe('S-27 Delete all data', () => {
  it('needs the exact word DELETE', () => {
    expect(isDeleteConfirmed('DELETE')).toBe(true);
    expect(isDeleteConfirmed('  DELETE ')).toBe(true);
    expect(isDeleteConfirmed('delete')).toBe(false);
    expect(isDeleteConfirmed('DELET')).toBe(false);
  });

  it('wipes rows, settings, files and notifications → onboarding again', async () => {
    const { db, files } = closedRentalWith3NotSelected();
    updateSettings(db, { onboarded: true, legalAcceptedAt: 'x', landlordName: 'Alex' });
    const n = makeFakeNotifications();
    await n.adapter.schedule({ id: 'x', title: '', body: '', at: NOW, channel: 'reminders', url: '/' });
    await deleteEverything(db, files, n.adapter);
    expect(listRentals(db)).toHaveLength(0);
    expect(getSettings(db)).toMatchObject({ onboarded: false, legalAcceptedAt: null, landlordName: '' });
    expect(files.files.size).toBe(0);
    expect(n.scheduled.size).toBe(0);
  });
});
