// expo-router vendors React Navigation; its context is the one the app's navigators provide. Read optionally
// (undefined outside a screen), which the public `useNavigation()` can't do — it throws. (Pattern from A006.)
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext.js';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useContext, useEffect, useReducer, useRef, type DependencyList } from 'react';

import type { TableName } from './repos/data';

/** SQLite tables a live query can depend on (names as in schema.ts). */
export type LiveTable = TableName;

const versions = new Map<string, number>();
const subs = new Map<string, Set<() => void>>();
let pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function flush() {
  timer = null;
  const changed = pending;
  pending = new Set();
  const notify = new Set<() => void>();
  for (const t of changed) {
    versions.set(t, (versions.get(t) ?? 0) + 1);
    subs.get(t)?.forEach((s) => notify.add(s));
  }
  notify.forEach((s) => s());
}

/** Record a change by hand (tests, or writes made on another connection). */
export function markTablesChanged(tables: readonly string[]) {
  tables.forEach((t) => pending.add(t));
  timer ??= setTimeout(flush, 16);
}

function start() {
  if (started) return;
  started = true;
  // One event per row written on the main connection (client.ts opens it with enableChangeListener).
  // A burst (transaction, sample load, restore) is coalesced into one notification per table.
  addDatabaseChangeListener((e) => markTablesChanged([e.tableName]));
}

/** Exported for tests. */
export function subscribe(tables: readonly string[], cb: () => void): () => void {
  for (const t of tables) {
    let set = subs.get(t);
    if (!set) subs.set(t, (set = new Set()));
    set.add(cb);
  }
  return () => tables.forEach((t) => subs.get(t)?.delete(cb));
}

/** Exported for tests. */
export const stampOf = (tables: readonly string[]) => tables.map((t) => versions.get(t) ?? 0).join(',');

function sameDeps(a: DependencyList, b: DependencyList) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
  return true;
}

/**
 * Synchronous SQLite query that follows the database:
 * `const cards = useLive(() => listApplicants(db, rentalId), [rentalId], ['applicants'])`.
 * Re-runs only when `deps` change or one of `tables` was written — not on every render. While its screen is not
 * focused (another tab, a screen pushed on top) a write only marks it stale; it refreshes when focused again.
 */
export function useLive<T>(query: () => T, deps: DependencyList, tables: readonly LiveTable[]): T {
  // Opt out of React Compiler: it would memoise `query()` by its closure, so a DB write re-renders with stale rows
  // (fact react-compiler-use-no-memo, A006).
  'use no memo';
  const navigation = useContext(NavigationContext);
  const [, rerender] = useReducer((x: number) => x + 1, 0);

  const stamp = stampOf(tables);
  // Render-time cache keyed by the tables' versions + the caller's deps (a variable-length useMemo).
  const cache = useRef<{ deps: DependencyList; stamp: string; value: T } | null>(null);
  /* eslint-disable react-hooks/refs */
  let c = cache.current;
  if (!c || c.stamp !== stamp || !sameDeps(c.deps, deps)) {
    c = { deps, stamp, value: query() };
    cache.current = c;
  }
  const value = c.value;
  /* eslint-enable react-hooks/refs */

  const rendered = useRef(stamp);
  useEffect(() => {
    rendered.current = stamp;
  });

  const key = tables.join(',');
  useEffect(() => {
    start();
    const list = key.split(',');
    let stale = false;
    const onChange = () => {
      if (navigation && !navigation.isFocused()) {
        stale = true;
        return;
      }
      rerender();
    };
    const off = subscribe(list, onChange);
    const offFocus = navigation?.addListener('focus', () => {
      if (stale || rendered.current !== stampOf(list)) {
        stale = false;
        rerender();
      }
    });
    // A write may have landed between render and subscribing.
    if (rendered.current !== stampOf(list)) onChange();
    return () => {
      off();
      offFocus?.();
    };
  }, [key, navigation]);

  return value; // eslint-disable-line react-hooks/refs -- the cached query result, see above
}

/** Re-renders when any of `tables` changes; returns a value that changes with them (e.g. a recompute key). */
export function useTablesVersion(tables: readonly LiveTable[]): string {
  'use no memo';
  return useLive(() => stampOf(tables), [], tables);
}
