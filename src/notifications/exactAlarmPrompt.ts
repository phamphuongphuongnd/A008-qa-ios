/**
 * The one-sentence question before the system "Alarms & reminders" screen (./exactAlarms `explain`), shown with the
 * app's own confirm dialog (B-151: not the system Alert — Not now left, Allow right, like every other dialog).
 * It is asked from code with no screen of its own (a clock starting, First-come turned on), so it works like
 * `showSnackbar`: `askExactAlarmPrompt()` opens it and resolves with the answer; `<ExactAlarmPromptHost/>` in the root
 * layout draws it. Asking again while it is open answers the earlier question "Not now".
 */
let pending: ((allow: boolean) => void) | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function askExactAlarmPrompt(): Promise<boolean> {
  pending?.(false);
  return new Promise<boolean>((resolve) => {
    pending = resolve;
    notify();
  });
}

export function answerExactAlarmPrompt(allow: boolean): void {
  const p = pending;
  pending = null;
  notify();
  p?.(allow);
}

export const isExactAlarmPromptOpen = (): boolean => pending !== null;

export function subscribeExactAlarmPrompt(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
