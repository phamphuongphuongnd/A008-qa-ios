import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Line icons drawn exactly as in the v2 mockup (24 grid, round caps). Status badges use these so Met / Not met /
 * Missing / Needs review / Verified / Claimed / Mismatch look like the design; everything else uses lucide-react-native.
 */
export type GlyphName =
  | 'check'
  | 'x'
  | 'ring'
  | 'bang'
  | 'clock'
  | 'shieldCheck'
  | 'bubble'
  | 'notEqual'
  | 'scale'
  | 'timer'
  | 'alertCircle'
  | 'trash'
  | 'lock'
  | 'queue';

const PATHS: Record<GlyphName, React.ReactNode> = {
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  ring: <Circle cx={12} cy={12} r={7} />,
  bang: <Path d="M12 5v9M12 18.5v.01" />,
  clock: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 7.5V12l3 2" />
    </>
  ),
  shieldCheck: (
    <>
      <Path d="M12 3l7 3v5.2c0 4.4-3 7.9-7 9.8-4-1.9-7-5.4-7-9.8V6z" />
      <Path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  bubble: <Path d="M5 5.5h14v10H10.5L6 19.5v-4H5z" />,
  notEqual: <Path d="M5 9.5h14M5 14.5h14M15.5 5l-7 14" />,
  scale: <Path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a2.5 2.5 0 005 0zM19 7l-2.5 6a2.5 2.5 0 005 0z" />,
  timer: (
    <>
      <Circle cx={12} cy={13} r={7.5} />
      <Path d="M12 9v4l2.5 1.5M9.5 3.5h5" />
    </>
  ),
  alertCircle: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7.5v5.5M12 16.5v.01" />
    </>
  ),
  trash: <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />,
  lock: (
    <>
      <Rect x={5} y={10.5} width={14} height={10} rx={2.5} />
      <Path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </>
  ),
  queue: (
    <>
      <Path d="M4 6.5h16M4 12h11M4 17.5h7" />
      <Circle cx={18.5} cy={16.5} r={2.5} />
    </>
  ),
};

export function Glyph({
  name,
  size = 20,
  color,
  strokeWidth,
}: {
  name: GlyphName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  // Mockup: 20 px at 1.8, 14 px at 2.2–2.4 (badges), 32 px at 1.6.
  const sw = strokeWidth ?? (size <= 14 ? 2.4 : size >= 32 ? 1.6 : 1.8);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {PATHS[name]}
    </Svg>
  );
}
