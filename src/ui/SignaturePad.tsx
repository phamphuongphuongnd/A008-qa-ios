import { useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Line, Path } from 'react-native-svg';

import { t } from '@/i18n';
import { font, useTheme } from '@/theme';

import { TextButton } from './Button';
import { strokesToPath, type SignatureStroke } from './signaturePath';
import { Txt } from './Txt';

export interface SignatureValue {
  /** SVG path data in pad coordinates. */
  path: string;
  width: number;
  height: number;
}

/**
 * Signature pad (S-08 Consent & signature): 150 high, dashed sign line with "×", Clear top right. Draw with a finger;
 * `onChange` gets the path after each stroke (null after Clear). Put it in a ScrollView: vertical drags on the pad
 * draw instead of scrolling.
 */
export function SignaturePad({
  onChange,
  height = 150,
  label,
  initialPath,
}: {
  onChange: (value: SignatureValue | null) => void;
  height?: number;
  /** Spoken name ("Applicant signature"). */
  label?: string;
  initialPath?: string;
}) {
  'use no memo'; // reads stroke refs while rendering (see below)
  const { colors, radius } = useTheme();
  // Refs, not state: the gesture callbacks run outside React's render and must see the latest strokes.
  const strokes = useRef<SignatureStroke[]>([]);
  const saved = useRef(initialPath ?? '');
  const width = useRef(0);
  const [padWidth, setPadWidth] = useState(0);
  const live = useRef<SignatureStroke>([]);
  const [, force] = useState(0);

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => {
      live.current = [{ x: e.x, y: e.y }];
      force((n) => n + 1);
    },
    onUpdate: (e) => {
      live.current.push({ x: e.x, y: e.y });
      force((n) => n + 1);
    },
    onFinalize: () => {
      if (!live.current.length) return;
      strokes.current = [...strokes.current, live.current];
      live.current = [];
      force((n) => n + 1);
      onChange({ path: `${saved.current}${strokesToPath(strokes.current)}`, width: width.current, height });
    },
  });

  const clear = () => {
    strokes.current = [];
    saved.current = '';
    live.current = [];
    force((n) => n + 1);
    onChange(null);
  };

  /* eslint-disable react-hooks/refs -- drawing reads the stroke refs on purpose (re-rendered by `force`). */
  const d = `${saved.current}${strokesToPath(live.current.length ? [...strokes.current, live.current] : strokes.current)}`;
  /* eslint-enable react-hooks/refs */
  const empty = !d;

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View
          onLayout={(e: LayoutChangeEvent) => {
            width.current = e.nativeEvent.layout.width;
            setPadWidth(e.nativeEvent.layout.width);
          }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${label ?? t('ui:signature.label')}, ${empty ? t('ui:signature.empty') : t('ui:signature.signed')}`}
          accessibilityHint={t('ui:signature.hint')}
          style={[
            styles.pad,
            { height, borderRadius: radius.md, backgroundColor: colors.surface1, borderColor: colors.lineStrong },
          ]}
        >
          <Txt style={[styles.x, font(500, 18, 20), { color: colors.inkMuted }]}>×</Txt>
          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Sign line: dashed, 20 from the sides, 38 from the bottom (an RN dashed one-side border fails on Android). */}
            <Line x1={20} x2={Math.max(20, padWidth - 20)} y1={height - 38} y2={height - 38} stroke={colors.lineStrong} strokeWidth={1.5} strokeDasharray="5 4" />
            <Path d={d} stroke={colors.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </View>
      </GestureDetector>
      <View style={styles.clr}>
        <TextButton label={t('ui:signature.clear')} onPress={clear} disabled={empty} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { borderWidth: 1.5, overflow: 'hidden' },
  x: { position: 'absolute', left: 20, bottom: 42 },
  clr: { position: 'absolute', right: 8, top: -2 },
});
