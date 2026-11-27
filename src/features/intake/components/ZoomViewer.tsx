/**
 * S-10 full-screen photo viewer (B-43): pinch to zoom (1–5×) around the fingers, drag when zoomed, double-tap to zoom
 * in / back out, ‹ / Back / ✕ to close — on Android and iOS (the old `ScrollView maximumZoomScale` zoomed on iOS only,
 * inside a 360-high sheet). Gestures: react-native-gesture-handler v3 hooks on the JS thread + RN Animated, the same
 * pattern as the UI kit's Sheet. The image never leaves the app folder.
 */
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { font } from '@/theme';
import { Txt } from '@/ui';

import { clampOffset, MAX_ZOOM, pinchTo, zoomAt, DOUBLE_TAP_ZOOM, type Zoom } from './zoomMath';

export function ZoomViewer({ uri, title, visible, onClose }: { uri: string; title: string; visible: boolean; onClose: () => void }) {
  'use no memo'; // gesture callbacks read / write the zoom refs outside render
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => ({ s: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) }));
  const zoom = useRef<Zoom>({ s: 1, x: 0, y: 0 });
  const start = useRef<{ z: Zoom; fx: number; fy: number }>({ z: { s: 1, x: 0, y: 0 }, fx: 0, fy: 0 });
  const size = useRef({ w: 1, h: 1 });

  const show = (z: Zoom, animate = false) => {
    zoom.current = z;
    if (animate) {
      Animated.parallel([
        Animated.spring(anim.s, { toValue: z.s, useNativeDriver: true, bounciness: 0 }),
        Animated.spring(anim.x, { toValue: z.x, useNativeDriver: true, bounciness: 0 }),
        Animated.spring(anim.y, { toValue: z.y, useNativeDriver: true, bounciness: 0 }),
      ]).start();
    } else {
      anim.s.setValue(z.s);
      anim.x.setValue(z.x);
      anim.y.setValue(z.y);
    }
  };
  /** Focal point relative to the centre of the viewing area. */
  const rel = (x: number, y: number) => ({ fx: x - size.current.w / 2, fy: y - size.current.h / 2 });

  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: (e) => {
      const { fx, fy } = rel(e.focalX, e.focalY);
      start.current = { z: zoom.current, fx, fy };
    },
    onUpdate: (e) => {
      const { fx, fy } = rel(e.focalX, e.focalY);
      show(pinchTo(start.current.z, start.current, { fx, fy }, e.scale, size.current));
    },
  });
  const pan = usePanGesture({
    runOnJS: true,
    maxPointers: 1,
    onActivate: () => {
      start.current = { z: zoom.current, fx: 0, fy: 0 };
    },
    onUpdate: (e) => {
      const z0 = start.current.z;
      if (z0.s <= 1) return;
      show(clampOffset({ s: z0.s, x: z0.x + e.translationX, y: z0.y + e.translationY }, size.current));
    },
  });
  const doubleTap = useTapGesture({
    runOnJS: true,
    numberOfTaps: 2,
    onActivate: (e) => {
      const { fx, fy } = rel(e.x, e.y);
      show(zoom.current.s > 1 ? { s: 1, x: 0, y: 0 } : zoomAt({ fx, fy }, DOUBLE_TAP_ZOOM, size.current), true);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, doubleTap);

  const close = () => {
    show({ s: 1, x: 0, y: 0 });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close} supportedOrientations={['portrait', 'landscape']}>
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={gesture}>
          <View
            style={StyleSheet.absoluteFill}
            collapsable={false}
            onLayout={(e: LayoutChangeEvent) => {
              size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
            }}
            accessible
            accessibilityRole="image"
            accessibilityLabel={title}
            accessibilityHint={t('intake:s10.zoomHint', { max: MAX_ZOOM })}
          >
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: anim.x }, { translateY: anim.y }, { scale: anim.s }] }]}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityIgnoresInvertColors />
            </Animated.View>
          </View>
        </GestureDetector>
        <View style={[styles.bar, { paddingTop: insets.top + 4, paddingLeft: insets.left + 4, paddingRight: insets.right + 16 }]} pointerEvents="box-none">
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={t('common:actions.close')} hitSlop={8} style={styles.close}>
            <X color="#fff" size={24} />
          </Pressable>
          <Txt numberOfLines={1} style={[font(600, 16, 22), styles.title]}>
            {title}
          </Txt>
        </View>
        <Txt style={[font(400, 13, 18), styles.hint, { bottom: insets.bottom + 16 }]} pointerEvents="none">
          {t('intake:s10.zoomHint', { max: MAX_ZOOM })}
        </Txt>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // A photo viewer stays black in light and dark themes (like the system gallery); text on it is white.
  root: { flex: 1, backgroundColor: '#000' },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', paddingBottom: 6 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', flex: 1 },
  hint: { position: 'absolute', alignSelf: 'center', color: '#fff', opacity: 0.8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
});
