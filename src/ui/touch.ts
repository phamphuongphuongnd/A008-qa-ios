import { size } from '@/theme/tokens';

/**
 * Smallest touch AND accessibility frame for anything pressable (48 dp, design token touch-min; Android / WCAG target).
 * B-75: reach it with the pressable's own size — a smaller look sits inside the 48 frame. hitSlop widens touches but
 * not the frame TalkBack / Switch Access use.
 */
export const TOUCH_MIN: number = size.touchMin;

/**
 * AppBar side width with a centred title (B-74): both sides as wide as the wider of the back button (48 frame) and the
 * measured right actions — not a fixed 88 each, which left a 320 dp phone too little room for the title.
 */
export function appBarSideWidth(back: boolean, rightWidth: number): number {
  return Math.max(back ? TOUCH_MIN : 0, Math.ceil(rightWidth));
}
