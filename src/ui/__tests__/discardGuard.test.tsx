/**
 * B-47: "Discard changes?" → Discard must leave the form (it used to re-dispatch the blocked action while the
 * prevention was still on, so the dialog came back forever). Runs on a real expo-router stack.
 */
import { Stack, router } from 'expo-router';
import { isValidElement, useEffect, useState, type ReactNode } from 'react';

import { renderApp, stackShape, step, unmountApp } from '@/navigation/testing/routerHarness';

import { useDiscardGuard } from '../Overlays';

// lucide ships ESM only (the UI kit's icons are not needed here).
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

type DialogProps = { visible: boolean; onKeep: () => void; onDiscard: () => void };

let dialog: DialogProps | null = null;
let dirty = true;
let saveAndLeave: (() => void) | null = null;

function FormScreen() {
  const [saved, setSaved] = useState(false);
  const guard: ReactNode = useDiscardGuard(dirty && !saved);
  useEffect(() => {
    dialog = isValidElement<DialogProps>(guard) ? guard.props : null;
    // What S-15 / S-14 do on Save: flag saved and go back in the same handler.
    saveAndLeave = () => {
      setSaved(true);
      router.back();
    };
  });
  return null;
}

const files = {
  _layout: () => <Stack />,
  index: () => null,
  form: FormScreen,
};

beforeEach(() => {
  dialog = null;
  dirty = true;
});
afterEach(unmountApp);

describe('useDiscardGuard (B-47)', () => {
  it('Back on a dirty form asks first; Keep editing stays; Discard leaves at once', async () => {
    await renderApp(files);
    await step(() => router.push('/form'));
    expect(stackShape()).toEqual(['index', 'form']);

    await step(() => router.back());
    expect(stackShape()).toEqual(['index', 'form']);
    expect(dialog?.visible).toBe(true);

    await step(() => dialog!.onKeep());
    expect(dialog?.visible).toBe(false);
    expect(stackShape()).toEqual(['index', 'form']);

    await step(() => router.back());
    expect(dialog?.visible).toBe(true);
    await step(() => dialog!.onDiscard());
    expect(stackShape()).toEqual(['index']);
  });

  it('Save that clears dirty and goes back in the same handler leaves without asking', async () => {
    await renderApp(files);
    await step(() => router.push('/form'));
    await step(() => saveAndLeave!());
    expect(dialog?.visible).toBe(false);
    expect(stackShape()).toEqual(['index']);
  });

  it('a clean form leaves without asking', async () => {
    dirty = false;
    await renderApp(files);
    await step(() => router.push('/form'));
    await step(() => router.back());
    expect(stackShape()).toEqual(['index']);
  });
});
