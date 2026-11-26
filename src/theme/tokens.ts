import type { TextStyle } from 'react-native';

import raw from '../../design/v2-indigo/design-tokens.json';

/**
 * Design tokens of the v2 Indigo design (product.md §9), read from `design/v2-indigo/design-tokens.json` at build time —
 * never typed in by hand. Token names become camelCase keys (`surface-0` → `surface0`, `ink-muted` → `inkMuted`).
 * A token missing from the JSON fails at import (and in tokens.test.ts).
 */

export type Scheme = 'light' | 'dark';

/** Colour token names as in design-tokens.json. */
export const COLOR_NAMES = [
  'surface-0',
  'surface-1',
  'surface-2',
  'line',
  'line-strong',
  'ink',
  'ink-muted',
  'accent',
  'accent-pressed',
  'on-accent',
  'accent-soft',
  'warn',
  'warn-soft',
  'danger',
  'on-danger',
  'danger-soft',
  'focus',
  'scrim',
] as const;
export type ColorName = (typeof COLOR_NAMES)[number];

type Camel<S extends string> = S extends `${infer A}-${infer B}` ? `${A}${Camel<Capitalize<B>>}` : S;
export type ColorKey = Camel<ColorName>;
/** One theme's colours: `colors.surface0`, `colors.inkMuted`, `colors.accentSoft`… (usage in design-tokens.json). */
export type Palette = Record<ColorKey, string>;

export const camel = (name: string) => name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const px = (v: string) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) throw new Error(`design-tokens.json: "${v}" is not a px value`);
  return n;
};

function buildPalettes(): Record<Scheme, Palette> {
  const light = {} as Palette;
  const dark = {} as Palette;
  for (const name of COLOR_NAMES) {
    const tok = raw.color.tokens.find((t) => t.name === name);
    if (!tok) throw new Error(`design-tokens.json: colour "${name}" missing`);
    const key = camel(name) as ColorKey;
    light[key] = tok.value.light;
    dark[key] = tok.value.dark;
  }
  return { light, dark };
}

export const palettes: Record<Scheme, Palette> = buildPalettes();

// ---------- type ----------

/** Inter is linked at four weights (app.json expo-font); 650 in the design renders as SemiBold. */
export function interFamily(weight: number): string {
  if (weight >= 700) return 'Inter_700Bold';
  if (weight >= 600) return 'Inter_600SemiBold';
  if (weight >= 500) return 'Inter_500Medium';
  return 'Inter_400Regular';
}

/** A text style from weight / size / line height (px) and letter spacing (em). */
export function font(weight: number, size: number, lineHeight: number, letterSpacingEm = 0): TextStyle {
  const base = { fontFamily: interFamily(weight), fontSize: size, lineHeight };
  return letterSpacingEm ? { ...base, letterSpacing: Math.round(letterSpacingEm * size * 100) / 100 } : base;
}

export const TYPE_NAMES = [
  'display',
  'title-1',
  'title-2',
  'body',
  'body-strong',
  'callout',
  'label',
  'caption',
  'badge',
  'figure',
] as const;
export type TypeName = (typeof TYPE_NAMES)[number];
export type TypeKey = Camel<TypeName>;

function buildType(): Record<TypeKey, TextStyle> {
  const out = {} as Record<TypeKey, TextStyle>;
  const styles = raw.type.groups.flatMap((g) => g.styles) as {
    name: string;
    fontSize: string;
    lineHeight: string;
    fontWeight: number;
    letterSpacing?: string;
  }[];
  for (const name of TYPE_NAMES) {
    const s = styles.find((x) => x.name === name);
    if (!s) throw new Error(`design-tokens.json: type style "${name}" missing`);
    const style = font(s.fontWeight, px(s.fontSize), px(s.lineHeight), s.letterSpacing ? parseFloat(s.letterSpacing) : 0);
    // "Use with tabular numerals" (figure); money and ratios line up in columns.
    out[camel(name) as TypeKey] = name === 'figure' ? { ...style, fontVariant: ['tabular-nums'] } : style;
  }
  return out;
}

/** Type scale: `type.title1`, `type.bodyStrong`, `type.caption`… */
export const type: Record<TypeKey, TextStyle> = buildType();

// ---------- spacing / radius / size ----------

function scale<K extends string>(group: { tokens: { name: string; value: string }[] }, prefix: string, keys: readonly K[]) {
  const out = {} as Record<K, number>;
  for (const k of keys) {
    const tok = group.tokens.find((t) => t.name === `${prefix}${k}`);
    if (!tok) throw new Error(`design-tokens.json: "${prefix}${k}" missing`);
    out[k] = px(tok.value);
  }
  return out;
}

/** space[1] = 4 … space[8] = 32. */
export const space = scale(raw.spacing, 'space-', ['1', '2', '3', '4', '5', '6', '8'] as const) as Record<
  1 | 2 | 3 | 4 | 5 | 6 | 8,
  number
>;
/** radius.sm 8 · md 12 · lg 16 · xl 24 · pill 999. */
export const radius = scale(raw.radius, 'radius-', ['sm', 'md', 'lg', 'xl', 'pill'] as const);
const sizeRaw = scale(raw.size, '', [
  'touch-min',
  'button-primary-h',
  'button-secondary-h',
  'tabbar-h',
  'content-max',
] as const);
/** size.touchMin 48 · buttonPrimaryH 52 · buttonSecondaryH 48 · tabbarH 64 · contentMax 600. */
export const size = {
  touchMin: sizeRaw['touch-min'],
  buttonPrimaryH: sizeRaw['button-primary-h'],
  buttonSecondaryH: sizeRaw['button-secondary-h'],
  tabbarH: sizeRaw['tabbar-h'],
  contentMax: sizeRaw['content-max'],
};

// ---------- shadow ----------

export interface Shadows {
  /** CSS box-shadow for `style.boxShadow`; undefined in dark (cards rely on surface-1 vs surface-0). */
  card: string | undefined;
  sheet: string | undefined;
}

function buildShadows(): Record<Scheme, Shadows> {
  const get = (name: string) => {
    const tok = raw.shadow.tokens.find((t) => t.name === name);
    if (!tok) throw new Error(`design-tokens.json: shadow "${name}" missing`);
    return tok.value;
  };
  const v = (s: string) => (s === 'none' ? undefined : s);
  const card = get('shadow-card');
  const sheet = get('shadow-sheet');
  return {
    light: { card: v(card.light), sheet: v(sheet.light) },
    dark: { card: v(card.dark), sheet: v(sheet.dark) },
  };
}

export const shadows: Record<Scheme, Shadows> = buildShadows();
