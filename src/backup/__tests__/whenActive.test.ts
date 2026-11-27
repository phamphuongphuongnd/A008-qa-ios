import { runWhenActive, type AppStateLike } from '../whenActive';

function fakeAppState() {
  const listeners = new Set<(s: string) => void>();
  const appState: AppStateLike = {
    addEventListener: (_t, l) => {
      listeners.add(l);
      return { remove: () => listeners.delete(l) };
    },
  };
  return { appState, emit: (s: string) => listeners.forEach((l) => l(s)), count: () => listeners.size };
}

describe('B-76 weekly backup when the app comes back (background task needs a network)', () => {
  it('runs on "active" only, one at a time, and survives a failing run', async () => {
    const a = fakeAppState();
    let resolve: () => void = () => {};
    const run = jest.fn(() => new Promise<void>((r) => (resolve = r)));
    const stop = runWhenActive(run, a.appState);
    a.emit('background');
    expect(run).not.toHaveBeenCalled();
    a.emit('active');
    a.emit('active'); // still running → not again
    expect(run).toHaveBeenCalledTimes(1);
    resolve();
    await Promise.resolve();
    await Promise.resolve();
    a.emit('active');
    expect(run).toHaveBeenCalledTimes(2);

    const failing = fakeAppState();
    const bad = jest.fn(() => Promise.reject(new Error('folder gone')));
    runWhenActive(bad, failing.appState);
    failing.emit('active');
    await new Promise((r) => setTimeout(r, 0));
    failing.emit('active');
    expect(bad).toHaveBeenCalledTimes(2);

    stop();
    expect(a.count()).toBe(0);
  });
});
