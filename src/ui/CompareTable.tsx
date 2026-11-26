import type { ReactNode } from 'react';
import { PixelRatio, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Evidence, Outcome } from '@/engine';
import { font, useTheme } from '@/theme';

import { BadgeRow, EvidenceTag, StatusBadge } from './Badges';
import { useCardStyle } from './Card';
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
  /** Criterion ("Income ≥ 3.0×"). */
  label: string;
  bold?: boolean;
  cells: Record<string, CompareCell>;
}

/** From 130 % text the table becomes one card per applicant (product.md §5.0). */
export function useCompareAsCards(): boolean {
  useWindowDimensions(); // re-render when the font scale changes
  return PixelRatio.getFontScale() >= 1.3;
}

/**
 * S-17 Compare table: criteria column pinned on the left, one column per applicant, scrolls sideways.
 * At ≥130 % text (or `cards`) it switches to stacked cards (applicant → criterion rows), as product.md requires.
 */
export function CompareTable({
  columns,
  rows,
  cornerLabel,
  cards,
}: {
  columns: readonly CompareColumn[];
  rows: readonly CompareRow[];
  /** Header of the pinned column ("Criteria"). */
  cornerLabel: string;
  cards?: boolean;
}) {
  const auto = useCompareAsCards();
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
              <View key={r.key} style={[styles.cardRow, { borderTopColor: colors.line }]}>
                <Txt style={font(r.bold ? 600 : 500, 15, 20)}>{r.label}</Txt>
                {renderCell(r.cells[col.key])}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  const PIN = 104;
  const COL = 120;
  return (
    <View style={[styles.table, { backgroundColor: colors.surface1, borderColor: colors.line, borderRadius: radius.lg }]}>
      <View style={{ flexDirection: 'row' }}>
        {/* Pinned criteria column */}
        <View style={{ width: PIN, borderRightWidth: 1, borderRightColor: colors.line }}>
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {columns.map((col) => (
            <View key={col.key} style={{ width: COL }}>
              <View style={[styles.hd, { backgroundColor: colors.surface2 }]}>
                <Txt numberOfLines={1} style={font(600, 14, 18)}>
                  {col.title}
                </Txt>
                {col.subtitle ? <Txt style={[font(400, 12, 16), { color: colors.inkMuted }]}>{col.subtitle}</Txt> : null}
              </View>
              {rows.map((r) => (
                <View
                  key={r.key}
                  style={[styles.cell, { borderTopColor: colors.line }]}
                  accessible
                  accessibilityLabel={`${col.title}, ${r.label}`}
                >
                  {renderCell(r.cells[col.key], true)}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function renderCell(cell: CompareCell | undefined, compact?: boolean): ReactNode {
  if (!cell) return null;
  if ('outcome' in cell) {
    return compact ? (
      <View style={{ gap: 4 }}>
        <StatusBadge outcome={cell.outcome} />
        {cell.evidence ? <EvidenceTag evidence={cell.evidence} compact /> : null}
      </View>
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
  hd: { height: 60, paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center' },
  pinCell: { paddingLeft: 12 },
  cell: { height: 72, paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'center', borderTopWidth: 1 },
  cardRow: { gap: 6, paddingTop: 10, borderTopWidth: 1 },
});
