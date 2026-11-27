import { listApplicants, setApplicantStatus, updateApplicant } from '@/db/repos/applicants';
import { getMoveIn } from '@/db/repos/movein';
import { getSampleRental } from '@/db/repos/rentals';
import { loadSampleRental } from '@/db/repos/sample';
import { updateSettings } from '@/db/repos/settings';
import { makeTestDb } from '@/db/testing/testDb';
import { moveInHtml, moveInFileName, svgDataUri } from '@/pdf/moveIn';
import { fileDate, type PdfAdapter } from '@/pdf/shell';
import { t } from '@/i18n';

import {
  bothSigned,
  canExport,
  defaultRooms,
  droppedFiles,
  editMoveIn,
  isBlankSignature,
  itemNameError,
  moveInProgress,
  newDraft,
  parseKeys,
  roomNameError,
  sign,
  strokesToSvg,
} from '../model';
import { applyMoveInEdit, draftOf, exportMoveIn, moveInPdfInput, openMoveIn, rentalAddress, signMoveIn, type MoveInFileReader } from '../service';

jest.mock('@/pdf/shellNative', () => ({ expoPdfAdapter: {} }));

const names = (rooms: { name: string }[]) => rooms.map((r) => r.name);

describe('model', () => {
  it('rooms from bedrooms / bathrooms (mockup order)', () => {
    expect(names(defaultRooms(2, 1))).toEqual(['Entry', 'Living room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bathroom 1']);
    expect(names(defaultRooms(0, 1.5))).toEqual(['Entry', 'Living room', 'Kitchen', 'Bathroom 1', 'Half bath']);
    expect(defaultRooms(1, 1)[2].items.map((i) => i.name)).toEqual([
      'Walls',
      'Floors',
      'Windows',
      'Doors & locks',
      'Lights & outlets',
      'Appliances',
      'Cabinets & counters',
      'Sink & faucet',
    ]);
  });

  it('edits: condition toggles, notes, photos, meters, keys, rooms', () => {
    let d = newDraft(2, 1);
    d = editMoveIn(d, { type: 'setCondition', room: 2, item: 0, condition: 'fair' }).draft;
    d = editMoveIn(d, { type: 'setNote', room: 2, item: 0, note: 'Scuff near the fridge, 10 cm' }).draft;
    d = editMoveIn(d, { type: 'addPhoto', room: 2, item: 0, path: 'rentals/1/movein-a.jpg' }).draft;
    d = editMoveIn(d, { type: 'setCondition', room: 2, item: 4, condition: 'damaged' }).draft;
    d = editMoveIn(d, { type: 'setMeter', meter: 'electric', value: ' 48,210 ' }).draft;
    d = editMoveIn(d, { type: 'setKeys', keys: 3 }).draft;
    d = editMoveIn(d, { type: 'setAlarms', tested: true }).draft;
    expect(d.rooms[2].items[0]).toEqual({ name: 'Walls', condition: 'fair', note: 'Scuff near the fridge, 10 cm', photoPaths: ['rentals/1/movein-a.jpg'] });
    expect(d.meters.electric).toBe('48,210');
    expect(moveInProgress(d)).toMatchObject({ rated: 2, damaged: 1, signed: { landlord: false, tenant: false } });
    // Tapping the same condition again clears it.
    expect(editMoveIn(d, { type: 'setCondition', room: 2, item: 0, condition: 'fair' }).draft.rooms[2].items[0].condition).toBeUndefined();

    d = editMoveIn(d, { type: 'addRoom', name: ' Garage ' }).draft;
    d = editMoveIn(d, { type: 'renameRoom', room: 6, name: 'Patio' }).draft;
    d = editMoveIn(d, { type: 'addItem', room: 6, name: 'Railing' }).draft;
    expect(d.rooms[6].name).toBe('Patio');
    expect(d.rooms[6].items.at(-1)?.name).toBe('Railing');
    const removed = editMoveIn(d, { type: 'removeRoom', room: 2 }).draft;
    expect(droppedFiles(d, removed)).toEqual(['rentals/1/movein-a.jpg']);
  });

  it('a signature covers what was signed: editing after it clears both', () => {
    let d = sign(newDraft(1, 1), 'landlord', 'rentals/1/signature-l.svg', '2027-01-01T10:00:00.000-05:00');
    expect(canExport(d)).toBe(false);
    d = sign(d, 'tenant', 'rentals/1/signature-t.svg', '2027-01-01T10:05:00.000-05:00');
    expect(bothSigned(d)).toBe(true);
    const r = editMoveIn(d, { type: 'setKeys', keys: 2 });
    expect(r.clearedSignatures).toBe(true);
    expect(canExport(r.draft)).toBe(false);
    expect(droppedFiles(d, r.draft).sort()).toEqual(['rentals/1/signature-l.svg', 'rentals/1/signature-t.svg']);
    expect(editMoveIn(newDraft(1, 1), { type: 'setKeys', keys: 2 }).clearedSignatures).toBe(false);
  });

  it('validation', () => {
    const rooms = defaultRooms(1, 1);
    expect(roomNameError('', rooms)).toBe('Enter a room name.');
    expect(roomNameError('kitchen', rooms)).toBe('There is already a room with this name.');
    expect(roomNameError('Kitchen', rooms, 2)).toBeNull();
    expect(roomNameError('x'.repeat(41), rooms)).toBeDefined();
    expect(itemNameError(' ')).toBe('Enter an item name.');
    expect(parseKeys('')).toEqual({ value: null, error: null });
    expect(parseKeys('3')).toEqual({ value: 3, error: null });
    expect(parseKeys('100').error).toBe('Enter a number from 0 to 99.');
    expect(parseKeys('-1').error).not.toBeNull();
  });

  it('signature SVG has numbers only; a dot is not a signature', () => {
    const svg = strokesToSvg(
      [
        [
          { x: 1.234, y: 2 },
          { x: 30, y: 40.06 },
        ],
        [{ x: 5, y: 5 }],
      ],
      300,
      120,
    );
    expect(svg).toContain('viewBox="0 0 300 120"');
    expect(svg).toContain('d="M1.2 2L30 40.1 M5 5L5.1 5"');
    expect(isBlankSignature([[{ x: 1, y: 1 }]])).toBe(true);
    expect(isBlankSignature([])).toBe(true);
  });
});

function sampleWithTenant() {
  const db = makeTestDb();
  loadSampleRental(db);
  const rental = getSampleRental(db)!;
  const jordan = listApplicants(db, rental.id).find((a) => a.fullName === 'Jordan Ellis')!;
  setApplicantStatus(db, jordan.id, 'approved');
  updateApplicant(db, jordan.id, { moveInOn: '2027-01-01' });
  return { db, rental, jordan };
}

describe('service (sample §8 rental)', () => {
  it('first open creates the checklist for the approved tenant; later opens reuse it', () => {
    const { db, rental, jordan } = sampleWithTenant();
    const id = openMoveIn(db, rental.id)!;
    const row = getMoveIn(db, rental.id)!;
    expect(row.id).toBe(id);
    expect(row.applicantId).toBe(jordan.id);
    expect(row.handoverOn).toBe('2027-01-01');
    expect(names(row.rooms!)).toEqual(['Entry', 'Living room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bathroom 1']);
    expect(openMoveIn(db, rental.id)).toBe(id);
    expect(openMoveIn(db, 999)).toBeNull();
    expect(rentalAddress(rental)).toBe('1428 Maple St, Unit B, Columbus, OH 43215');
  });

  it('autosaves edits, deletes dropped files, sets done when both signed', () => {
    const { db, rental } = sampleWithTenant();
    openMoveIn(db, rental.id);
    const deleted: string[] = [];
    const fs = { deleteFile: (p: string) => deleted.push(p) };
    let row = getMoveIn(db, rental.id)!;
    applyMoveInEdit(db, fs, row.id, row, { type: 'addPhoto', room: 0, item: 0, path: 'rentals/1/movein-1.jpg' });
    row = getMoveIn(db, rental.id)!;
    applyMoveInEdit(db, fs, row.id, row, { type: 'removePhoto', room: 0, item: 0, path: 'rentals/1/movein-1.jpg' });
    expect(deleted).toEqual(['rentals/1/movein-1.jpg']);

    row = getMoveIn(db, rental.id)!;
    signMoveIn(db, fs, row, 'landlord', 'rentals/1/sig-l1.svg', '2027-01-01T10:00:00.000-05:00');
    row = getMoveIn(db, rental.id)!;
    signMoveIn(db, fs, row, 'landlord', 'rentals/1/sig-l2.svg', '2027-01-01T10:01:00.000-05:00');
    expect(deleted).toContain('rentals/1/sig-l1.svg');
    expect(getMoveIn(db, rental.id)!.doneAt).toBeNull();
    row = getMoveIn(db, rental.id)!;
    signMoveIn(db, fs, row, 'tenant', 'rentals/1/sig-t.svg', '2027-01-01T10:02:00.000-05:00');
    expect(getMoveIn(db, rental.id)!.doneAt).not.toBeNull();

    row = getMoveIn(db, rental.id)!;
    expect(applyMoveInEdit(db, fs, row.id, row, { type: 'setKeys', keys: 4 }).clearedSignatures).toBe(true);
    expect(getMoveIn(db, rental.id)!.doneAt).toBeNull();
  });

  it('B-52: a signature is stamped in local ISO with the device offset (not UTC "Z")', () => {
    const { db, rental } = sampleWithTenant();
    openMoveIn(db, rental.id);
    signMoveIn(db, { deleteFile: () => {} }, getMoveIn(db, rental.id)!, 'landlord', 'rentals/1/sig-l.svg');
    const at = draftOf(getMoveIn(db, rental.id)!).signatures.landlord!.at;
    expect(at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(Math.abs(new Date(at).getTime() - Date.now())).toBeLessThan(60_000);
  });
});

describe('PDF', () => {
  const reader: MoveInFileReader = {
    dataUri: async (p) => (p.endsWith('.jpg') ? 'data:image/jpeg;base64,AAAA' : null),
    text: async () => '<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1L2 2"/></svg>',
  };

  async function signedRow() {
    const { db, rental } = sampleWithTenant();
    updateSettings(db, { landlordName: 'Alex <Morgan>' });
    openMoveIn(db, rental.id);
    const fs = { deleteFile: () => {} };
    let row = getMoveIn(db, rental.id)!;
    for (const e of [
      { type: 'setCondition', room: 2, item: 0, condition: 'fair' },
      { type: 'setNote', room: 2, item: 0, note: 'Scuff <b>near</b> the fridge & "sink"' },
      { type: 'addPhoto', room: 2, item: 0, path: 'rentals/1/movein-1.jpg' },
      { type: 'setCondition', room: 2, item: 4, condition: 'damaged' },
      { type: 'setMeter', meter: 'electric', value: '48,210' },
      { type: 'setMeter', meter: 'water', value: '1,032' },
      { type: 'setKeys', keys: 3 },
      { type: 'setAlarms', tested: true },
    ] as const) {
      applyMoveInEdit(db, fs, row.id, row, e);
      row = getMoveIn(db, rental.id)!;
    }
    signMoveIn(db, fs, row, 'landlord', 'rentals/1/sig-l.svg', '2027-01-01T10:00:00.000-05:00');
    signMoveIn(db, fs, getMoveIn(db, rental.id)!, 'tenant', 'rentals/1/sig-t.svg', '2027-01-01T10:05:00.000-05:00');
    return { db, rental, row: getMoveIn(db, rental.id)! };
  }

  it('prints every field, escaped, with the disclaimer and both signatures', async () => {
    const { db, row } = await signedRow();
    const { input } = await moveInPdfInput(db, row, reader, { includePhotos: true });
    const out = moveInHtml(input);
    expect(out).toContain('Move-in checklist');
    expect(out).toContain('1428 Maple St, Unit B, Columbus, OH 43215');
    expect(out).toContain('Jordan Ellis');
    expect(out).toContain('Jan 1, 2027');
    expect(out).toContain('Scuff &lt;b&gt;near&lt;/b&gt; the fridge &amp; &quot;sink&quot;');
    expect(out).not.toContain('<b>near</b>');
    expect(out).toContain('<span class="damaged">Damaged</span>');
    expect(out).toContain('1 photo');
    expect(out).toContain('48,210 kWh');
    expect(out).toContain('1,032 gal');
    expect(out).not.toContain('m³');
    expect(out).not.toContain('>Gas<');
    expect(out).toContain('Smoke &amp; CO alarms tested');
    expect(out).toContain('Alex &lt;Morgan&gt;');
    expect(out).toContain('Signed Jan 1, 2027, 10:05 AM');
    expect(out).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(out).toContain(`src="${svgDataUri('<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1L2 2"/></svg>')}"`);
    expect(out).toContain('Evenlease is a checklist, not legal advice. Laws vary by state and city.');

    const noPhotos = moveInHtml((await moveInPdfInput(db, row, reader, { includePhotos: false })).input);
    expect(noPhotos).not.toContain('base64,AAAA');
  });

  it('never prints a non-data image source', async () => {
    const { db, row } = await signedRow();
    const { input } = await moveInPdfInput(db, row, { ...reader, dataUri: async () => 'file:///etc/passwd' }, { includePhotos: true });
    expect(moveInHtml(input)).not.toContain('file:///');
  });

  it('export needs both signatures; file name is type + rental id + date (B-49)', async () => {
    const { db, row } = await signedRow();
    const adapter: PdfAdapter = {
      printToFile: jest.fn(async () => ({ uri: 'file:///tmp/x.pdf', numberOfPages: 2 })),
      moveToCache: jest.fn(async (_u: string, name: string) => `file:///cache/${name}`),
      isSharingAvailable: jest.fn(async () => true),
      share: jest.fn(async () => {}),
    };
    const r = await exportMoveIn(db, row, reader, { includePhotos: false, adapter });
    expect(r).toEqual({ uri: `file:///cache/Move-in checklist - rental ${row.rentalId} - ${fileDate()}.pdf`, numberOfPages: 2, shared: true });
    expect(moveInFileName(3, new Date(2026, 10, 27))).toBe('Move-in checklist - rental 3 - 2026-11-27');

    const unsigned = { ...row, signatures: { landlord: draftOf(row).signatures.landlord } };
    await expect(exportMoveIn(db, unsigned, reader, { includePhotos: false, adapter })).rejects.toThrow();
  });
});

describe('S-20 meter units (US meters)', () => {
  it('Electric kWh · Gas ccf · Water gallons', () => {
    expect(['electric', 'gas', 'water'].map((k) => t(`system:s20.meterUnit.${k as 'gas'}`))).toEqual(['kWh', 'ccf', 'gal']);
  });
});
