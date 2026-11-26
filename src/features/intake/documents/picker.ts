/**
 * "+ Add" sources of S-10 / paper-form photos (S-08 part 7): Camera · Photos · Files (PDF). Native pickers sit behind
 * `AttachmentPicker` (./pickerNative.ts on the phone, a fake in Jest). A denied camera never blocks the landlord:
 * the screen keeps "Choose from Photos" and "Choose a PDF" (product.md F-07).
 */
export type PickSource = 'camera' | 'library' | 'file';

export type PickResult =
  | { status: 'picked'; uri: string; mime: string | null; name: string | null }
  | { status: 'cancelled' }
  | { status: 'denied'; source: PickSource; canAskAgain: boolean }
  | { status: 'error' };

export interface AttachmentPicker {
  camera(): Promise<PickResult>;
  library(): Promise<PickResult>;
  file(): Promise<PickResult>;
}

/** Runs one source; native failures become `error` (never thrown at the screen). */
export async function pick(picker: AttachmentPicker, source: PickSource): Promise<PickResult> {
  try {
    return await (source === 'camera' ? picker.camera() : source === 'library' ? picker.library() : picker.file());
  } catch {
    return { status: 'error' };
  }
}

/** Sources still offered after a result (a denied camera drops only the camera). */
export function sourcesAfter(result: PickResult, current: readonly PickSource[] = ['camera', 'library', 'file']): PickSource[] {
  return result.status === 'denied' ? current.filter((s) => s !== result.source) : [...current];
}
