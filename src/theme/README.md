# src/theme — v2 Indigo theme (owner 1D)

Tokens are read from `design/v2-indigo/design-tokens.json` at build time (`tokens.ts`), never typed by hand.

- `useTheme()` → `{ scheme, dark, colors, type, space, radius, size, shadows }`
  - `colors`: camelCase token names — `surface0/1/2, line, lineStrong, ink, inkMuted, accent, accentPressed, onAccent,
    accentSoft, warn, warnSoft, danger, onDanger, dangerSoft, focus, scrim` (usage notes in the JSON).
  - `type`: `display, title1, title2, body, bodyStrong, callout, label, caption, badge, figure` (Inter; 650 → SemiBold;
    `figure` tabular). `font(weight, size, lineHeight, letterSpacingEm)` for one-off styles of the mockup CSS.
  - `space[1|2|3|4|5|6|8]`, `radius.sm|md|lg|xl|pill`, `size.touchMin|buttonPrimaryH|buttonSecondaryH|tabbarH|contentMax`,
    `shadows.card|sheet` (CSS strings for `boxShadow`; undefined in dark).
- `ThemeProvider preference="system|light|dark"` — force a subtree (gallery). `withAlpha(hex, a)`, `contrastRatio(a, b)`.
- **Stored preference** (`@/theme/preference`, opens the DB so it is not in the index):
  `AppThemeProvider` (root layout), `useThemePreference()`, `setThemePreference('system'|'light'|'dark')` → settings.theme,
  `SystemBars` (status bar, Android navigation-bar buttons, window colour follow the app theme).
- Tests: `__tests__/tokens.test.ts` — JSON coverage + WCAG AA for the main text / edge pairs in both themes.
