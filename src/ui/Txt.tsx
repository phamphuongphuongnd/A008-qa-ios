import { Text, type TextProps } from 'react-native';

import { fonts, layout, type, useTheme, type ColorName, type FontWeightName, type TypeName } from '@/theme';

export interface TxtProps extends TextProps {
  /** title 28 · heading 21 · subhead 17 · body 15 · secondary 14 · small 13 · label 13/600 · caption 12 caps · hint 12. */
  v?: TypeName;
  c?: ColorName;
  /** Money, counts, dates, ratios: tabular digits so columns line up. */
  num?: boolean;
  /** Override the variant's weight. */
  weight?: FontWeightName;
}

/** Text with the mockup's type scale (Inter). Follows the phone's text size up to 200%. */
export function Txt({ v = 'body', c, num, weight, style, maxFontSizeMultiplier, children, ...rest }: TxtProps) {
  const { colors } = useTheme();
  const s = type[v];
  const color = colors[c ?? (v === 'caption' || v === 'label' || v === 'hint' || v === 'secondary' ? 'text2' : 'text')];
  const upper = 'uppercase' in s && s.uppercase;
  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? layout.maxFontScale}
      style={[
        {
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
          letterSpacing: 'letterSpacing' in s ? s.letterSpacing : undefined,
          fontFamily: fonts[weight ?? s.weight],
          color,
          textTransform: upper ? 'uppercase' : undefined,
        },
        num ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}
