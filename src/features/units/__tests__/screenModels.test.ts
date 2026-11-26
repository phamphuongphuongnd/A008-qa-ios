import {
  BATHROOM_OPTIONS,
  BEDROOM_OPTIONS,
  STATE_OPTIONS,
  backupReminderText,
  editorTexts,
  hubMenuItems,
  hubReviewButton,
  optionLabel,
  rentalErrorMessages,
  rentalsView,
  statusTone,
  swipeActions,
  swipeLabel,
} from '../screenModels';

describe('S-02 view logic', () => {
  it('maps status to the mockup chip tones', () => {
    expect([statusTone('open'), statusTone('offer_out'), statusTone('leased'), statusTone('closed')]).toEqual([
      'accent',
      'warn',
      'neutral',
      'outline',
    ]);
  });

  it('picks the empty state', () => {
    expect(rentalsView('open', { open: 0, closed: 0 })).toBe('empty_all');
    expect(rentalsView('open', { open: 0, closed: 2 })).toBe('empty_open');
    expect(rentalsView('closed', { open: 1, closed: 0 })).toBe('empty_closed');
    expect(rentalsView('closed', { open: 1, closed: 1 })).toBe('list');
  });

  it('writes the backup reminder like the mockup', () => {
    expect(backupReminderText({ days: 34 })).toBe('Back up your data — last backup 34 days ago');
    expect(backupReminderText({ days: null })).toBe('Back up your data — no backup yet');
  });

  it('offers Close on open rentals, Reopen + Delete on closed ones', () => {
    expect(swipeActions('open')).toEqual(['close']);
    expect(swipeActions('leased')).toEqual(['close']);
    expect(swipeActions('closed')).toEqual(['reopen', 'delete']);
    expect(swipeActions('closed').map(swipeLabel)).toEqual(['Reopen', 'Delete']);
  });
});

describe('S-06 view logic', () => {
  it('lists the ⋯ menu in product order, Delete last and red', () => {
    expect(hubMenuItems('open').map((m) => m.label)).toEqual([
      'Edit rental',
      'Edit criteria',
      'Published criteria',
      'Decision file',
      'Close rental',
      'Delete rental',
    ]);
    expect(hubMenuItems('closed').map((m) => m.key)).toContain('reopenRental');
    expect(hubMenuItems('open').filter((m) => m.danger).map((m) => m.key)).toEqual(['deleteRental']);
  });

  it('shows Compare or Order queue with the count, none without applicants', () => {
    expect(hubReviewButton({ reviewMode: 'compare', applicantCount: 4 })).toEqual({ kind: 'compare', label: 'Compare applicants · 4' });
    expect(hubReviewButton({ reviewMode: 'first_come', applicantCount: 3 })).toEqual({ kind: 'queue', label: 'Order queue · 3' });
    expect(hubReviewButton({ reviewMode: 'compare', applicantCount: 0 })).toBeNull();
  });
});

describe('S-03 view logic', () => {
  it('titles and main button for create / edit', () => {
    expect(editorTexts(true)).toEqual({ title: 'New rental', subtitle: 'Step 1 of 3', button: 'Next: criteria' });
    expect(editorTexts(false)).toEqual({ title: 'Edit rental', subtitle: null, button: 'Save' });
  });

  it('translates errors', () => {
    expect(rentalErrorMessages({ street: 'streetRequired', zip: 'zip', notes: 'tooLong' })).toEqual({
      street: 'Enter the street address',
      zip: 'ZIP must be 5 digits',
      notes: 'Keep it under 120 characters',
    });
  });

  it('has picker options: Studio–8 bd, bathrooms in halves, 51 states', () => {
    expect(BEDROOM_OPTIONS.map((o) => o.label)).toEqual(['Studio', '1', '2', '3', '4', '5', '6', '7', '8']);
    expect(BATHROOM_OPTIONS.map((o) => o.value)).toEqual([null, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    expect(STATE_OPTIONS).toHaveLength(51);
    expect(optionLabel(STATE_OPTIONS, 'WA')).toBe('Washington');
    expect(optionLabel(STATE_OPTIONS, '', 'Choose')).toBe('Choose');
  });
});
