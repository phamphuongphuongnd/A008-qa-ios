/** @jest-environment node */
import { AUTOSAVE_DELAY_MS, createDebouncedSaver, createFlushRegistry } from '../autosave';

describe('B-51 autosave: notes / meters save while typing, flush on leave', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('commits the latest text once after a pause in typing', () => {
    const commit = jest.fn();
    const s = createDebouncedSaver(commit);
    s.change('S');
    s.change('Sc');
    jest.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    s.change('Scuff');
    jest.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('Scuff');
    expect(s.pending).toBe(false);
  });

  it('flush (blur / unmount / background) commits at once and only once; nothing waiting → no-op', () => {
    const commit = jest.fn();
    const s = createDebouncedSaver(commit);
    s.flush();
    expect(commit).not.toHaveBeenCalled();
    s.change('48,210');
    expect(s.pending).toBe(true);
    s.flush();
    expect(commit).toHaveBeenCalledWith('48,210');
    jest.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    s.flush();
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('cancel drops the waiting text', () => {
    const commit = jest.fn();
    const s = createDebouncedSaver(commit);
    s.change('x');
    s.cancel();
    jest.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2);
    s.flush();
    expect(commit).not.toHaveBeenCalled();
  });

  it('registry flushes every waiting field (before another edit / sheet / Export); a commit that flushes again does not loop', () => {
    const reg = createFlushRegistry();
    const saved: string[] = [];
    const a = createDebouncedSaver((v) => {
      saved.push(`a:${v}`);
      reg.flushAll(); // the screen's edit() flushes everything first
    });
    const b = createDebouncedSaver((v) => saved.push(`b:${v}`));
    const offA = reg.add(a.flush);
    reg.add(b.flush);
    a.change('note');
    b.change('1,032');
    reg.flushAll();
    expect(saved).toEqual(['a:note', 'b:1,032']);
    offA();
    a.change('later');
    reg.flushAll();
    expect(saved).toHaveLength(2);
  });
});
