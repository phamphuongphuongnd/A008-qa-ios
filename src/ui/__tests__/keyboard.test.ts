/**
 * B-72d: room for the bottom Sheet with the keyboard up. On a landscape tablet (1280×800 dp) the S-22 "Set a backup
 * password" sheet squeezed its fields to 0 high under KeyboardAvoidingView; the sheet now gets an explicit height
 * budget and, when it is short, scrolls its footer with the fields.
 */
import { keyboardOverlap, SHEET_COMPACT_ROOM, sheetRoom } from '../keyboard';

const insets = { top: 24, bottom: 48 };

describe('keyboardOverlap', () => {
  it('full-screen modal: the part of the window under the keyboard', () => {
    expect(keyboardOverlap({ y: 0, height: 800 }, { screenY: 420, height: 380 }, 800)).toBe(380);
  });
  it('window already shrunk above the keyboard (adjustResize): nothing to add', () => {
    expect(keyboardOverlap({ y: 0, height: 420 }, { screenY: 420, height: 380 }, 800)).toBe(0);
  });
  it('Samsung edge-to-edge reports screenY too low: the keyboard height wins', () => {
    expect(keyboardOverlap({ y: 0, height: 800 }, { screenY: 468, height: 380 }, 800)).toBe(380);
  });
});

describe('sheetRoom', () => {
  it('no keyboard: 92 % of the window, padded above the navigation bar', () => {
    expect(sheetRoom(800, 0, insets)).toEqual({ keyboardSpace: 0, maxHeight: 736, paddingBottom: 68, compact: false });
  });
  it('landscape tablet, keyboard up: everything above the keyboard, footer scrolls with the fields', () => {
    const r = sheetRoom(800, 380, insets);
    expect(r).toEqual({ keyboardSpace: 380, maxHeight: 388, paddingBottom: 12, compact: true });
  });
  it('tall phone, keyboard up: room enough, footer stays fixed', () => {
    const r = sheetRoom(915, 330, insets);
    expect(r.maxHeight).toBeGreaterThanOrEqual(SHEET_COMPACT_ROOM);
    expect(r.compact).toBe(false);
  });
  it('never negative', () => {
    expect(sheetRoom(300, 400, insets).maxHeight).toBe(0);
  });
});
