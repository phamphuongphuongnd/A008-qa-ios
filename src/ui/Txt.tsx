import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type ColorKey, type TypeKey } from '@/theme';

export interface TxtProps extends TextProps {
  /** Type style from design-tokens.json (default body). */
  variant?: TypeKey;
  /** Colour token (default ink). */
  color?: ColorKey;
  /** Tabular numerals (money, ratios, times). */
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  weight?: 400 | 500 | 600 | 700;
}

const FAMILY = { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' } as const;

/** Text in the design's type scale. Scales with the phone's font size (allowFontScaling stays on). */
export function Txt({ variant = 'body', color = 'ink', tabular, align, weight, style, ...rest }: TxtProps) {
  const t = useTheme();
  return (
    <Text
      {...rest}
      style={[
        t.type[variant],
        { color: t.colors[color] },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        weight ? { fontFamily: FAMILY[weight] } : null,
        style,
      ]}
    />
  );
}
