/** S-05 "Copy as text": tiny adapter over expo-clipboard so jest can inject a fake. */
import * as Clipboard from 'expo-clipboard';

export interface ClipboardAdapter {
  setText(text: string): Promise<void>;
}

export const expoClipboard: ClipboardAdapter = {
  async setText(text) {
    await Clipboard.setStringAsync(text);
  },
};

/** Copies; false when the platform refused (the screen shows nothing then, the text stays on screen). */
export async function copyText(text: string, adapter: ClipboardAdapter = expoClipboard): Promise<boolean> {
  try {
    await adapter.setText(text);
    return true;
  } catch {
    return false;
  }
}
