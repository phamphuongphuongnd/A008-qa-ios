/**
 * S-20 text fields (item notes, meter readings) save while typing (B-51): a short debounce after each keystroke, and an
 * immediate flush when the field blurs, the screen unmounts (‹ / Back), the app goes to the background, or the screen is
 * about to do something else (another edit, a sheet, Export). Before, they saved only on blur — leaving the screen
 * with the field still focused lost the text.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export const AUTOSAVE_DELAY_MS = 600;

interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface DebouncedSaver {
  /** New text: (re)starts the timer; `commit` runs with the latest text when it fires. */
  change(value: string): void;
  /** Commit the waiting text now (no-op when nothing waits). */
  flush(): void;
  /** Drop the waiting text. */
  cancel(): void;
  /** Replace the commit function (the latest props' callback). */
  setCommit(commit: (value: string) => void): void;
  readonly pending: boolean;
}

export function createDebouncedSaver(commit: (value: string) => void, delayMs = AUTOSAVE_DELAY_MS, timers: Timers = realTimers): DebouncedSaver {
  let handle: unknown = null;
  let current = commit;
  let waiting: string | null = null;
  const fire = () => {
    if (waiting === null) return;
    const v = waiting;
    waiting = null;
    if (handle !== null) timers.clear(handle);
    handle = null;
    current(v); // timer cleared first: a commit that flushes everything again cannot loop back here
  };
  return {
    change(value) {
      waiting = value;
      if (handle !== null) timers.clear(handle);
      handle = timers.set(fire, delayMs);
    },
    flush: fire,
    cancel() {
      if (handle !== null) timers.clear(handle);
      handle = null;
      waiting = null;
    },
    setCommit(c) {
      current = c;
    },
    get pending() {
      return waiting !== null;
    },
  };
}

/** Flushes every field's waiting save at once (before a structural edit, a sheet, Export). */
export interface FlushRegistry {
  add(flush: () => void): () => void;
  flushAll(): void;
}

export function createFlushRegistry(): FlushRegistry {
  const all = new Set<() => void>();
  return {
    add(flush) {
      all.add(flush);
      return () => {
        all.delete(flush);
      };
    },
    flushAll() {
      for (const f of [...all]) f();
    },
  };
}

/**
 * Local text for a field whose saved value is `saved`. `commit` gets the text (the caller trims / compares).
 * - `immediate` (the checklist is signed): every change commits at once, so the screen asks "Editing clears both
 *   signatures" on the first keystroke instead of after leaving; the caller remounts the field to revert on Cancel.
 * - Otherwise: debounced, flushed on blur / unmount / app background / `registry.flushAll()`.
 * The saved value coming back from our own commit never overwrites what is being typed; any other change of `saved`
 * (another device edit, undo) replaces the local text.
 */
export function useAutosaveText(
  saved: string,
  commit: (value: string) => void,
  opts: { immediate: boolean; registry?: FlushRegistry; delayMs?: number },
) {
  'use no memo';
  const [text, setText] = useState(saved);
  const [seen, setSeen] = useState(saved);
  const [sent, setSent] = useState<string | null>(null);
  if (saved !== seen) {
    setSeen(saved);
    if (saved !== sent) setText(saved);
  }

  const [saver] = useState(() => createDebouncedSaver(() => {}, opts.delayMs));
  // The timer (and the unmount flush) commit through the latest render's callback.
  useEffect(() => {
    saver.setCommit((v) => {
      setSent(v.trim());
      commit(v);
    });
  });

  const registry = opts.registry;
  useEffect(() => {
    const unregister = registry?.add(saver.flush);
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') saver.flush();
    });
    return () => {
      sub.remove();
      unregister?.();
      saver.flush(); // leaving the screen (‹ / Back / room switch) with the field still focused
    };
  }, [saver, registry]);

  return {
    text,
    onChangeText(v: string) {
      setText(v);
      if (opts.immediate) {
        saver.cancel();
        commit(v);
      } else {
        saver.change(v);
      }
    },
    /** onBlur / onSubmitEditing. */
    flush: saver.flush,
  };
}
