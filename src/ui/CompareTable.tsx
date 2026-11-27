import type { ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';

import type { Evidence, Outcome } from '@/engine';
import { t } from '@/i18n';
import { font, useTheme, withAlpha } from '@/theme';

import { BadgeRow, EvidenceTag, StatusBadge, evidenceLabel, outcomeLabel } from './Badges';
import { useCardStyle } from './Card';
import { COMPARE_HEADER_HEIGHT, COMPARE_ROW_HEIGHT, COMPARE_WINDOW, compareColumnWidth, comparePinWidth } from './compareLayout';
import { COMPARE_CARDS_FONT_SCALE, fontScaleAtLeast } from './fontScale';
import { Txt } from './Txt';

export interface CompareColumn {
  key: string;
  /** "Jordan E." */
  title: string;
  /** "Dec 2, 9:14". */
  subtitle?: string;
}

/** A cell: a criterion result (badge + evidence) or plain text (the Issues count). */
export type CompareCell =
  | { outcome: Outcome; evidence?: Evidence }
  | { text: string; tone?: 'ink' | 'warn' | 'muted'; bold?: boolean };

export interface CompareRow {
  key: string;
  /** Short criterion label ("Income ≥ 3.0×", `criterionCompareLabel`). */
  label: string;
  bold?: boolean;
  cells: Record<string, CompareCell>;
}

/** From 130 % text the table becomes one card per applicant (product.md §5 S-17). Re-renders when the scale changes. */
export function useCompareAsCards(): boolean {
  return fontScaleAtLeast(useWindowDimensions().fontScale, COMPARE_CARDS_FONT_SCALE);
}

/**
 * S-17 Compare table: criteria column pinned on the left, one column per applicant, scrolls sideways.
 * At ≥130 % text (or `cards`) it switches to stacked cards (applicant → criterion rows), as product.md requires.
 * With `onCellPress` every cell (table) / criterion row (cards) is a button — S-17 opens the evidence sheet.
 */
export function CompareTable({
  columns,
  rows,
  cornerLabel,
  cards,
  onCellPress,
}: {
  columns: readonly CompareColumn[];
  rows: readonly CompareRow[];
  /** Header of the pinned column ("Criteria"). */
  cornerLabel: string;
  cards?: boolean;
  /** Tap on one applicant's cell for one row. */
  onCellPress?: (rowKey: string, columnKey: string) => void;
}) {
  const auto = useCompareAsCards();
  const { fontScale } = useWindowDimensions();
  const colWidth = compareColumnWidth(fontScale);
  const pinWidth = comparePinWidth(fontScale);
  const { colors, radius } = useTheme();
  const card = useCardStyle();
  if (cards ?? auto) {
    return (
      <View style={{ gap: 12 }}>
        {columns.map((col) => (
          <View key={col.key} style={[card, { boxShadow: undefined, padding: 14, gap: 10 }]}>
            <View>
              <Txt accessibilityRole="header" style={font(650, 18, 24)}>
                {col.title}
              </Txt>
              {col.subtitle ? <Txt variant="caption" color="inkMuted">{col.subtitle}</Txt> : null}
            </View>
            {rows.map((r) => (
              <CellPress
                key={r.key}
                label={cellLabel(col, r)}
                onPress={onCellPress ? () => onCellPress(r.key, col.key) : undefined}
                style={[styles.cardRow, { borderTopColor: colors.line }]}
              >
                <Txt style={font(r.bold ? 600 : 500, 15, 20)}>{r.label}</Txt>
                {renderCell(r.cells[col.key])}
              </CellPress>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.table, { backgroundColor: colors.surface1, borderColor: colors.line, borderRadius: radius.lg }]}>
      <View style={{ flexDirection: 'row' }}>
        {/* Pinned criteria column */}
        <View style={{ width: pinWidth, borderRightWidth: 1, borderRightColor: colors.line }}>
          <View style={[styles.hd, styles.pinCell, { backgroundColor: colors.surface2 }]}>
            <Txt style={font(600, 14, 18)}>{cornerLabel}</Txt>
          </View>
          {rows.map((r) => (
            <View key={r.key} style={[styles.cell, styles.pinCell, { borderTopColor: colors.line }]}>
              <Txt numberOfLines={3} style={font(r.bold ? 600 : 500, 13, 17)}>
                {r.label}
              </Txt>
            </View>
          ))}
        </View>
        {/* Applicant columns: virtualised sideways (B-71) — 20 applicants no longer mount 200 cells at once. */}
        <FlatList
          horizontal
          style={{ flex: 1 }}
          data={columns as CompareColumn[]}
          keyExtractor={(col) => col.key}
          renderItem={({ item }) => <TableColumn col={item} rows={rows} width={colWidth} onCellPress={onCellPress} />}
          getItemLayout={(_, index) => ({ length: colWidth, offset: colWidth * index, index })}
          extraData={rows}
          showsHorizontalScrollIndicator={false}
          {...COMPARE_WINDOW}
        />
      </View>
    </View>
  );
}

/** One applicant's column: name header + one cell per row. */
function TableColumn({
  col,
  rows,
  width,
  onCellPress,
}: {
  col: CompareColumn;
  rows: readonly CompareRow[];
  width: number;
  onCellPress?: (rowKey: string, columnKey: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ width }}>
      <View style={[styles.hd, { backgroundColor: colors.surface2 }]}>
        <Txt numberOfLines={1} style={font(600, 14, 18)}>
          {col.title}
        </Txt>
        {col.subtitle ? <Txt style={[font(400, 12, 16), { color: colors.inkMuted }]}>{col.subtitle}</Txt> : null}
      </View>
      {rows.map((r) => (
        <CellPress
          key={r.key}
          label={cellLabel(col, r)}
          onPress={onCellPress ? () => onCellPress(r.key, col.key) : undefined}
          style={[styles.cell, styles.cellStack, { borderTopColor: colors.line }]}
        >
          {renderCell(r.cells[col.key], true)}
        </CellPress>
      ))}
    </View>
  );
}

/** Screen reader: "Jordan E., Income ≥ 3.0×, Met, Verified" / "Jordan E., Issues, 2". */
function cellLabel(col: CompareColumn, row: CompareRow): string {
  const cell = row.cells[col.key];
  const value = !cell
    ? []
    : 'outcome' in cell
      ? [outcomeLabel(cell.outcome), cell.evidence ? evidenceLabel(cell.evidence) : null]
      : [cell.text];
  return [col.title, row.label, ...value].filter(Boolean).join(', ');
}

/** One cell: a button when it can be tapped, else a single accessible element. */
function CellPress({
  label,
  onPress,
  style,
  children,
}: {
  label: string;
  onPress?: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const { colors, dark } = useTheme();
  if (!onPress) {
    return (
      <View style={style} accessible accessibilityLabel={label}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('ui:compare.cellHint')}
      style={({ pressed }) => [style, pressed && { backgroundColor: withAlpha(colors.ink, dark ? 0.12 : 0.05) }]}
    >
      {children}
    </Pressable>
  );
}

function renderCell(cell: CompareCell | undefined, compact?: boolean): ReactNode {
  if (!cell) return null;
  if ('outcome' in cell) {
    // Compact: badge + tag straight in the cell (styles.cellStack), no wrapper View per cell.
    return compact ? (
      <>
        <StatusBadge outcome={cell.outcome} />
        {cell.evidence ? <EvidenceTag evidence={cell.evidence} compact /> : null}
      </>
    ) : (
      <BadgeRow>
        <StatusBadge outcome={cell.outcome} />
        {cell.evidence ? <EvidenceTag evidence={cell.evidence} /> : null}
      </BadgeRow>
    );
  }
  return <CellText {...cell} />;
}

function CellText({ text, tone = 'ink', bold }: { text: string; tone?: 'ink' | 'warn' | 'muted'; bold?: boolean }) {
  const { colors } = useTheme();
  const color = tone === 'warn' ? colors.warn : tone === 'muted' ? colors.inkMuted : colors.ink;
  return (
    <Txt tabular style={[font(bold || tone === 'warn' ? 600 : 400, 14, 20), { color }]}>
      {text}
    </Txt>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: 1, overflow: 'hidden' },
  // Fixed heights keep the pinned column and the scrolling columns aligned (≥130 % text uses cards instead).
  hd: { height: COMPARE_HEADER_HEIGHT, paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center' },
  pinCell: { paddingLeft: 12 },
  cell: { height: COMPARE_ROW_HEIGHT, paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center', borderTopWidth: 1 },
  cellStack: { gap: 4 },
  cardRow: { gap: 6, paddingTop: 10, borderTopWidth: 1 },
});
