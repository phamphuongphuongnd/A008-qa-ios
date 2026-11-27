/**
 * App lock gate (S-23): covers the whole app while `useAppLockGate().locked`. Asks for Face ID / fingerprint /
 * phone passcode at once; phones with neither use the app PIN. Rendered by app/_layout.tsx over the
 * stack: `{shown ? <LockScreen pinBlockedUntil={...} /> : null}` with `shown = isLockVisible(...)` (../lock.ts), and the
 * stack inside `<LockShield hidden={shown}>`
 * so screen readers can't reach the data behind the lock (B-70).
 */
import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { font, useTheme } from '@/theme';
import { Button, Logo, Txt } from '@/ui';
import { useKeyboardOverlap } from '@/ui/keyboard';

import { useSettings } from '../hooks';
import { lockScreenPadding, lockShieldA11y } from '../lock';
import { unlockLandlord, unlockWithPin } from '../lockController';
import { expoAuthAdapter } from '../lockNative';
import { PinUnlock } from './PinFields';

/**
 * Wraps the app's screens. While the lock is up, the whole tree under it leaves the accessibility tree — Android
 * `no-hide-descendants` (TalkBack can neither read nor tap it), iOS `accessibilityElementsHidden` — B-70.
 * (`accessibilityViewIsModal` on the lock screen only works on iOS.)
 */
export function LockShield({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <View style={styles.shield} {...lockShieldA11y(hidden)}>
      {children}
    </View>
  );
}

export function LockScreen({ pinBlockedUntil }: { pinBlockedUntil: number }) {
  'use no memo';
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [mode, setMode] = useState<'system' | 'pin'>('system');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const asked = useRef(false);
  // B-140: the PIN pad opens the keyboard over the bottom of this full-screen layer — measure how much it covers.
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const { overlap, onLayout } = useKeyboardOverlap(rootRef);
  const pad = lockScreenPadding(overlap, insets);
  useEffect(() => {
    if (overlap > 0) scrollRef.current?.scrollToEnd({ animated: true });
  }, [overlap]);

  const ask = async () => {
    setBusy(true);
    setMessage(null);
    const r = await unlockLandlord(expoAuthAdapter, settings, { prompt: t('system:lock.prompt'), cancel: t('common:actions.cancel') });
    setBusy(false);
    if (r === 'use_pin' || r === 'needs_pin') setMode('pin');
    else if (r === 'lockout') setMessage(t('system:lock.lockout'));
    else if (r === 'unavailable') {
      if (settings.appPinHash) setMode('pin');
      else setMessage(t('system:lock.unavailable'));
    }
  };

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    ask();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once when the lock appears
  }, []);

  const blockedSeconds = Math.max(0, Math.ceil((pinBlockedUntil - now) / 1000));
  useEffect(() => {
    if (blockedSeconds <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [blockedSeconds]);

  return (
    <View ref={rootRef} onLayout={onLayout} style={[StyleSheet.absoluteFill, styles.layer, { backgroundColor: colors.surface0 }]} accessibilityViewIsModal>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.root, { paddingTop: pad.top, paddingBottom: pad.bottom }]}
      >
      <Logo height={44} />
      <Txt accessibilityRole="header" style={[font(700, 22, 28), { textAlign: 'center' }]}>
        {t('system:lock.title')}
      </Txt>
      {message ? (
        <Txt color="inkMuted" style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">
          {message}
        </Txt>
      ) : null}
      <View style={styles.actions}>
        {mode === 'pin' ? (
          <PinUnlock
            blockedSeconds={blockedSeconds}
            error={message}
            onSubmit={async (pin) => {
              const r = await unlockWithPin(pin, settings);
              setNow(Date.now());
              setMessage(r === 'wrong' ? t('system:lock.wrongPin') : null);
            }}
          />
        ) : (
          <Button label={t('system:lock.unlock')} onPress={ask} loading={busy} block />
        )}
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shield: { flex: 1 },
  layer: { zIndex: 100 },
  // flexGrow: the actions stay pinned to the bottom (marginTop auto) — above the keyboard when it is up.
  root: { flexGrow: 1, alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  // B-76: centred on wide screens ('stretch' + maxWidth pinned it to the left edge).
  actions: { alignSelf: 'center', maxWidth: 420, width: '100%', marginTop: 'auto' },
});
