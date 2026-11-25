/**
 * Design tokens of the approved mockup (design/tokens.json + design/ev.css). One source for every screen; the UI kit
 * (src/ui) reads them through `useTheme()`. Colours keep the mockup names (`text2`, `accentSoft`…).
 */

export type Scheme = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  text2: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  /** Missing outcome (dashed outline). */
  missing: string;
  /** Text on a filled danger button (ev.css `.btn.dn`). */
  onDanger: string;
  /** Sheet / dialog backdrop. */
  scrim: string;
  /** Pressed state layer over a transparent control. */
  pressTint: string;
  /** Keyboard focus ring. */
  focusRing: string;
  /** Snackbar (same dark grey in both themes, ev.css `.snack`). */
  snackBg: string;
  snackText: string;
  /** Switch thumb. */
  thumb: string;
}

export const palettes: Record<Scheme, Palette> = {
  light: {
    bg: '#F7F6F2',
    surface: '#FFFFFF',
    surface2: '#EFECE5',
    border: '#DCD7CC',
    text: '#1A1C1E',
    text2: '#585D62',
    accent: '#1F5C63',
    accentSoft: '#E1EDED',
    onAccent: '#FFFFFF',
    warning: '#9A4A0B',
    warningSoft: '#FBEADB',
    danger: '#A93A27',
    dangerSoft: '#F7E2DD',
    missing: '#6A6F74',
    onDanger: '#FFFFFF',
    scrim: 'rgba(12,14,16,0.45)',
    pressTint: 'rgba(26,28,30,0.08)',
    focusRing: '#1F5C63',
    snackBg: '#24282C',
    snackText: '#FFFFFF',
    thumb: '#FFFFFF',
  },
  dark: {
    bg: '#111315',
    surface: '#1A1D20',
    surface2: '#24282C',
    border: '#343A3F',
    text: '#ECEDEE',
    text2: '#A9B0B5',
    accent: '#7CC2C9',
    accentSoft: '#1B3538',
    onAccent: '#0B1A1C',
    warning: '#F2A866',
    warningSoft: '#3A2817',
    danger: '#F29683',
    dangerSoft: '#3D201B',
    missing: '#A3A9AE',
    onDanger: '#1A0D0A',
    scrim: 'rgba(0,0,0,0.6)',
    pressTint: 'rgba(236,237,238,0.10)',
    focusRing: '#7CC2C9',
    snackBg: '#2E3338',
    snackText: '#FFFFFF',
    thumb: '#FFFFFF',
  },
};

export type ColorName = keyof Palette;

/** Inter is linked into the Android APK (expo-font plugin) and loaded at runtime on iOS (app/_layout.tsx). */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  /** The mockup's 650 is drawn with SemiBold (only 400/500/600/700 are bundled). */
  strong: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;
export type FontWeightName = keyof typeof fonts;

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  weight: FontWeightName;
  letterSpacing?: number;
  uppercase?: boolean;
}

/** tokens.json `type` + ev.css (.h1 .h2 .h3 .sub .sm .cap .hint .lbl .legal). */
export const type = {
  title: { fontSize: 28, lineHeight: 32, weight: 'bold', letterSpacing: -0.56 },
  heading: { fontSize: 21, lineHeight: 26, weight: 'strong', letterSpacing: -0.21 },
  subhead: { fontSize: 17, lineHeight: 22, weight: 'semibold' },
  body: { fontSize: 15, lineHeight: 21, weight: 'regular' },
  secondary: { fontSize: 14, lineHeight: 20, weight: 'regular' },
  small: { fontSize: 13, lineHeight: 18, weight: 'regular' },
  label: { fontSize: 13, lineHeight: 18, weight: 'semibold' },
  caption: { fontSize: 12, lineHeight: 16, weight: 'strong', letterSpacing: 0.72, uppercase: true },
  hint: { fontSize: 12, lineHeight: 16, weight: 'regular' },
} as const satisfies Record<string, TypeStyle>;
export type TypeName = keyof typeof type;

export const radius = { card: 14, button: 12, input: 10, chip: 13, badge: 6, sheet: 20, dialog: 18, pill: 18, seg: 10 } as const;

export const size = {
  buttonPrimary: 52,
  buttonSecondary: 48,
  buttonText: 44,
  buttonSmall: 36,
  iconButton: 44,
  fab: 56,
  input: 48,
  /** Minimum touch area (product.md §5.0: ≥ 48). Smaller drawings get hitSlop up to this. */
  touch: 48,
  screenWidth: 390,
} as const;

export const space = { xxs: 2, xs: 4, sm: 6, md: 10, lg: 12, xl: 16, xxl: 20, xxxl: 24 } as const;

/** Screen padding (ev.css `.body` 20) and content width cap on tablets (Components: "tablets max 600 centered"). */
export const layout = { gutter: 20, maxContentWidth: 600, maxFontScale: 2 } as const;

/** CSS box-shadow strings for `style.boxShadow` (RN 0.76+). */
export const shadows: Record<Scheme, { fab: string; segOn: string; paper: string; thumb: string }> = {
  light: {
    fab: '0px 4px 14px rgba(0,0,0,0.18)',
    segOn: '0px 1px 2px rgba(0,0,0,0.12)',
    paper: '0px 2px 12px rgba(0,0,0,0.14)',
    thumb: '0px 1px 2px rgba(0,0,0,0.2)',
  },
  dark: {
    fab: '0px 4px 14px rgba(0,0,0,0.45)',
    segOn: '0px 1px 2px rgba(0,0,0,0.4)',
    paper: '0px 2px 12px rgba(0,0,0,0.4)',
    thumb: '0px 1px 2px rgba(0,0,0,0.4)',
  },
};

export const state = { disabledOpacity: 0.38, pressedDarken: 0.88, rippleAlpha: 0.16, focusRing: { width: 2, offset: 2 } } as const;
