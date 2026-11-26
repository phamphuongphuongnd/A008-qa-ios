import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { MARK_BARS, MARK_HOUSE, WORDMARK } from './logoPaths';

/** Brand indigo of the logo files (same in both themes, like the app icon). */
const BRAND = '#4F46E5';

/**
 * Evenlease mark from design/v2-indigo/logo:
 * - `app` — the app icon: indigo rounded square, white house with two indigo "=" bars (evenlease-app-icon.svg);
 * - `mono` — the house alone in indigo with white bars (evenlease-mark-mono.svg), or `color` for one-colour use.
 */
export function LogoMark({ size = 48, variant = 'app', color }: { size?: number; variant?: 'app' | 'mono'; color?: string }) {
  const label = t('common:appName');
  if (variant === 'mono') {
    const fill = color ?? BRAND;
    return (
      <Svg width={size} height={(size * 584) / 560} viewBox="232 216 560 584" accessibilityLabel={label} accessible>
        <Path d={MARK_HOUSE} fill={fill} stroke={fill} strokeWidth={44} strokeLinejoin="round" />
        {MARK_BARS.map((b) => (
          <Rect key={b.y} {...b} fill="#FFFFFF" />
        ))}
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel={label} accessible>
      <Rect width={1024} height={1024} rx={232} fill={BRAND} />
      <Path d={MARK_HOUSE} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={44} strokeLinejoin="round" />
      {MARK_BARS.map((b) => (
        <Rect key={b.y} {...b} fill={BRAND} />
      ))}
    </Svg>
  );
}

/** "Evenlease" wordmark (outlined Inter, evenlease-wordmark.svg) in ink (light) / #eceef6 (dark) unless `color`. */
export function Wordmark({ height = 24, color }: { height?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={(height * 442) / 120} height={height} viewBox={WORDMARK.viewBox} accessibilityLabel={t('common:appName')} accessible>
      <Path d={WORDMARK.d} fill={color ?? colors.ink} />
    </Svg>
  );
}

/**
 * Lock-up = app mark + wordmark, proportions of evenlease-logo.svg / evenlease-logo-on-dark.svg (the dark file only
 * changes the wordmark colour, which follows the theme here). `height` = mark size.
 */
export function Logo({ height = 40 }: { height?: number }) {
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={t('common:appName')} style={{ flexDirection: 'row', alignItems: 'center', gap: height * 0.23 }}>
      <View importantForAccessibility="no-hide-descendants">
        <LogoMark size={height} />
      </View>
      <View importantForAccessibility="no-hide-descendants">
        <Wordmark height={height * 0.873} />
      </View>
    </View>
  );
}
