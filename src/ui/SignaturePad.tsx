import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { t } from '@/i18n';
import { radius, useTheme } from '@/theme';

import { Button } from './Button';
import { Txt } from './Txt';

/** A signature: one SVG path per stroke ("M12.0 40.5 L13.2 41.0 …") in a `width` × `height` box. */
export interface Signature {
  strokes: string[];
  width: number;
  height: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The signature as a standalone SVG (save as a file next to the applicant, or inline in a PDF `<img>`). */
export function signatureToSvg(sig: Signature, color = '#1A1C1E'): string {
  const paths = sig.strokes.map((d) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sig.width} ${sig.height}" width="${sig.width}" height="${sig.height}">${paths}</svg>`;
}

export function isSignatureEmpty(sig: Signature | null | undefined): boolean {
  return !sig || sig.strokes.length === 0;
}

/**
 * Hand signature box (S-08 consent, S-20 landlord / tenant). Draw with a finger; "Clear" starts again. Lines draw in the
 * theme's text colour; export with `signatureToSvg(sig)` (black by default, for paper). 110 high like the mockup.
 * Inside a ScrollView use the ScrollView from react-native-gesture-handler so drawing doesn't scroll the page.
 */
export function SignaturePad({
  value,
  onChange,
  label,
  error,
  height = 110,
}: {
  value: Signature | null;
  onChange: (sig: Signature | null) => void;
  /** "Signature" / "Tenant signature" — the field label and screen-reader name. */
  label: string;
  error?: string | null;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [current, setCurrent] = useState<string | null>(null);
  const strokes = value?.strokes ?? [];
  // Gesture callbacks may keep the config of an earlier render: read the latest props / stroke through refs.
  const drawing = useRef<string | null>(null);
  const latest = useRef({ strokes, width, height, onChange });
  useEffect(() => {
    latest.current = { strokes, width, height, onChange };
  });

  const pan = usePanGesture({
    runOnJS: true,
    minDistance: 0,
    onBegin: (e) => {
      drawing.current = `M${r1(e.x)} ${r1(e.y)}`;
      setCurrent(drawing.current);
    },
    onUpdate: (e) => {
      drawing.current = `${drawing.current ?? `M${r1(e.x)} ${r1(e.y)}`} L${r1(e.x)} ${r1(e.y)}`;
      setCurrent(drawing.current);
    },
    onFinalize: () => {
      const d = drawing.current;
      drawing.current = null;
      setCurrent(null);
      if (!d) return;
      const l = latest.current;
      // A tap = a dot.
      l.onChange({ strokes: [...l.strokes, d.includes('L') ? d : `${d} l0.1 0.1`], width: Math.round(l.width), height: l.height });
    },
  });

  const signed = strokes.length > 0 || !!current;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Txt v="label" style={{ flex: 1 }}>
          {label}
        </Txt>
        <Button variant="text" label={t('ui:signature.clear')} accessibilityLabel={t('ui:signature.clearA11y', { label })} onPress={() => onChange(null)} disabled={!signed} />
      </View>
      <GestureDetector gesture={pan}>
        <View
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="image"
          accessibilityLabel={signed ? t('ui:signature.captured', { label }) : t('ui:signature.empty', { label })}
          style={[
            styles.box,
            { height, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border, borderWidth: error ? 2 : 1.5, borderStyle: signed || error ? 'solid' : 'dashed' },
          ]}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          {!signed ? (
            <Txt v="hint" style={styles.placeholder}>
              {t('ui:signature.placeholder')}
            </Txt>
          ) : null}
          <Svg width="100%" height={height} style={StyleSheet.absoluteFill}>
            {[...strokes, ...(current ? [current] : [])].map((d, i) => (
              <Path key={i} d={d} fill="none" stroke={colors.text} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>
      </GestureDetector>
      {error ? (
        <Txt v="hint" weight="semibold" c="danger" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  box: { borderRadius: radius.button, overflow: 'hidden' },
  line: { position: 'absolute', left: 16, right: 16, bottom: 22, height: 1 },
  placeholder: { position: 'absolute', left: 16, bottom: 28 },
});
