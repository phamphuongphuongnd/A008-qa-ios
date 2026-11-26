/**
 * Jest-only helpers for the verify screen render tests (never imported by the app). Renders with `test-renderer`,
 * finds host nodes by text / accessibility label, presses them through the fiber's `onPress`, and provides a
 * replacement for ../hooks that reads the in-memory test database and re-renders after every action.
 */
import { act, useReducer, useEffect, type ReactElement } from 'react';
import { createRoot, type Root, type TestInstance } from 'test-renderer';

import type { AppDb } from '@/db/types';

import * as S from '../service';
import type { PickResult, VerifyNative } from '../links';
import { openExternal } from '../links';

export const store: {
  db: AppDb | null;
  listeners: Set<() => void>;
  native: VerifyNative & { openUrl: jest.Mock; pick: jest.Mock };
  saver: S.ReportFileSaver;
} = {
  db: null,
  listeners: new Set(),
  native: { openUrl: jest.fn(async () => undefined), pick: jest.fn(async (): Promise<PickResult> => ({ status: 'canceled' })) },
  saver: { saveAttachment: jest.fn(async (o) => ({ path: `applicants/${o.owner.applicantId}/report-${Date.now()}.pdf` })) },
};

const db = () => {
  if (!store.db) throw new Error('store.db not set');
  return store.db;
};
const notify = <T,>(v: T): T => {
  store.listeners.forEach((l) => l());
  return v;
};

function useStore<T>(read: () => T): T {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    store.listeners.add(force);
    return () => {
      store.listeners.delete(force);
    };
  }, []);
  return read();
}

const files = { deleteFile: jest.fn(), deleteDir: jest.fn() };

/** Drop-in for ../hooks (jest.mock('../hooks', () => require('../testing/harness').hooksMock)). */
export const hooksMock = {
  useLandlordSheet: (a: number, r: number) => useStore(() => S.loadLandlordSheet(db(), a, r)),
  useEmployerSheet: (a: number, i: number) => useStore(() => S.loadEmployerSheet(db(), a, i)),
  useReportSheet: (a: number) => useStore(() => S.loadReportSheet(db(), a)),
  useBackgroundSheet: (a: number) => useStore(() => S.loadBackgroundSheet(db(), a)),
  verifyActions: {
    saveLandlord: (a: number, r: number, f: Parameters<typeof S.saveLandlordSheet>[3]) => notify(S.saveLandlordSheet(db(), a, r, f)),
    ensureLandlordRef: (a: number, r: number) => S.ensureLandlordRef(db(), a, r),
    saveEmployer: (a: number, i: number, f: Parameters<typeof S.saveEmployerSheet>[3]) => notify(S.saveEmployerSheet(db(), a, i, f)),
    ensureEmployerRef: (a: number, i: number) => S.ensureEmployerRef(db(), a, i),
    logAttempt: (ref: number, input: S.AttemptInput) => notify(S.logAttempt(db(), ref, input)),
    removeAttempt: (id: number, ref: number) => notify(S.removeAttempt(db(), id, ref)),
    markUnreachable: (ref: number) => notify(S.markUnreachable(db(), ref)),
    clearUnreachable: (ref: number) => notify(S.clearUnreachable(db(), ref)),
    saveReport: (a: number, f: Parameters<typeof S.saveReportSheet>[2]) => notify(S.saveReportSheet(db(), a, f)),
    attachReportFiles: async (a: number, picked: readonly S.PickedFile[]) => notify(await S.attachReportFiles(db(), store.saver, a, picked)),
    removeReportFile: (a: number, path: string) => notify(S.removeReportFile(db(), files, a, path)),
    clearReport: (a: number) => notify(S.clearReport(db(), files, a)),
    saveBackground: (a: number, f: Parameters<typeof S.saveBackgroundSheet>[2]) => notify(S.saveBackgroundSheet(db(), a, f)),
    chooseBackgroundOutcome: (a: number, f: Parameters<typeof S.chooseBackgroundOutcome>[2], o: 'continue' | 'withdraw') =>
      notify(S.chooseBackgroundOutcome(db(), a, f, o)),
    openUrl: (url: string) => openExternal(store.native, url),
    pick: (source: 'camera' | 'photos' | 'files') => store.native.pick(source),
  },
};

export async function render(el: ReactElement): Promise<Root> {
  const root = createRoot();
  await act(async () => {
    root.render(el);
  });
  return root;
}

function textOf(n: TestInstance): string {
  return n.children.map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
}

/** Every text shown (one entry per Text host). */
export function texts(root: Root): string[] {
  return root.container.queryAll((n) => n.type === 'Text', { matchDeepestOnly: true }).map(textOf);
}

export function hasText(root: Root, s: string): boolean {
  return texts(root).some((x) => x.includes(s));
}

export function byLabel(root: Root, label: string): TestInstance[] {
  return root.container.queryAll((n) => n.props.accessibilityLabel === label);
}

export function byText(root: Root, s: string): TestInstance[] {
  return root.container.queryAll((n) => n.type === 'Text' && textOf(n) === s, { matchDeepestOnly: true });
}

/** Calls the nearest `onPress` up the fiber tree from a host node (like a tap). */
export async function press(node: TestInstance | undefined): Promise<void> {
  if (!node) throw new Error('press: node not found');
  let f = node.unstable_fiber;
  while (f && typeof f.memoizedProps?.onPress !== 'function') f = f.return;
  if (!f) throw new Error('press: no onPress');
  const onPress = f.memoizedProps.onPress as () => unknown;
  await act(async () => {
    await onPress();
  });
}

/** Host TextInput under a field label. */
export function input(root: Root, label: string): TestInstance {
  const inputs = root.container.queryAll((n) => n.type === 'TextInput' && (n.props.accessibilityLabel === label || String(n.props.accessibilityLabel ?? '').startsWith(`${label}, `) || n.props.placeholder === label));
  if (!inputs[0]) throw new Error(`input not found: ${label}`);
  return inputs[0];
}

export async function type(node: TestInstance, text: string, blur = true): Promise<void> {
  await act(async () => {
    node.props.onChangeText?.(text);
  });
  if (blur) {
    await act(async () => {
      node.props.onBlur?.({});
    });
  }
}

/** Calls a composite component's callback prop (e.g. DateField `onChange`) found by its `label` prop. */
export async function callProp(root: Root, label: string, prop: string, ...args: unknown[]): Promise<void> {
  for (const host of root.container.queryAll(() => true)) {
    let f = host.unstable_fiber;
    while (f) {
      const p = f.memoizedProps as Record<string, unknown> | null;
      if (p && p.label === label && typeof p[prop] === 'function') {
        const fn = p[prop] as (...a: unknown[]) => unknown;
        await act(async () => {
          await fn(...args);
        });
        return;
      }
      f = f.return;
    }
  }
  throw new Error(`callProp: ${label}.${prop} not found`);
}
