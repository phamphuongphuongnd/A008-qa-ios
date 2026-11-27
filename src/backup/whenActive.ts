/**
 * Fallback for the weekly backup (B-76): the Android background task never runs offline (expo-background-task's
 * network constraint), so `run` (runAutoIfDue — does nothing unless a backup is due) also runs whenever the app comes
 * back to the front. One run at a time. Returns the unsubscribe.
 */
export type AppStateLike = {
  addEventListener: (type: 'change', listener: (state: string) => void) => { remove: () => void };
};

export function runWhenActive(run: () => Promise<unknown>, appState: AppStateLike): () => void {
  let running = false;
  const sub = appState.addEventListener('change', (state) => {
    if (state !== 'active' || running) return;
    running = true;
    run()
      .catch(() => {})
      .finally(() => {
        running = false;
      });
  });
  return () => sub.remove();
}
