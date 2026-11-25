import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/** True while the on-screen keyboard is open (hide FABs, keep totals / Save in view — B-36, B-38). */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}
