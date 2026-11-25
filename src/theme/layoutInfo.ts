import { useWindowDimensions } from 'react-native';

import { layout } from './tokens';

export interface LayoutInfo {
  /** Window width (dp). */
  width: number;
  /** Width of the content column: the window, capped at 600 on tablets. */
  contentWidth: number;
  fontScale: number;
  /** S-17 Compare: from 130% text the table becomes one card per applicant (product.md §5.0). */
  stackTables: boolean;
  /** Label + value side by side no longer fit (320 dp + large text): put them on two lines. */
  stackRows: boolean;
  tablet: boolean;
}

/** Pure version for tests. */
export function layoutInfoFor(width: number, fontScale: number): LayoutInfo {
  const contentWidth = Math.min(width, layout.maxContentWidth);
  return {
    width,
    contentWidth,
    fontScale,
    stackTables: fontScale >= 1.3,
    // A006 B-110: below ~240 dp per text-scale unit a label and its figure don't fit on one line.
    stackRows: contentWidth / Math.min(fontScale, layout.maxFontScale) < 240,
    tablet: width >= layout.maxContentWidth,
  };
}

/** Screen size + text size rules of product.md §5.0 (320–430 phones, tablet column 600, text up to 200%). */
export function useLayoutInfo(): LayoutInfo {
  const { width, fontScale } = useWindowDimensions();
  return layoutInfoFor(width, fontScale);
}
