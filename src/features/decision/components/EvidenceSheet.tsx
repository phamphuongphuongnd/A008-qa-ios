/**
 * Evidence sheet (S-09 criterion tap, S-17 cell tap): result badges, reason, source / date / who checked / files, the
 * issues, then the button to the place to add more. Content from `evidenceSheetView` (../viewModel).
 */
import { View } from 'react-native';

import { Button, EvidenceTag, KeyValue, Sheet, StatusBadge, Txt } from '@/ui';

import type { EvidenceSheetView } from '../viewModel';
import { Hint } from './DecisionParts';

export function EvidenceSheet({
  sheet,
  onClose,
  onAction,
}: {
  /** null = closed. */
  sheet: EvidenceSheetView | null;
  onClose: () => void;
  /** The action button: the sheet closes first, then this gets the href. */
  onAction: (href: string) => void;
}) {
  return (
    <Sheet visible={!!sheet} onClose={onClose} title={sheet?.title}>
      {sheet ? (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <StatusBadge outcome={sheet.outcome} />
            {sheet.evidence ? <EvidenceTag evidence={sheet.evidence} /> : null}
          </View>
          <Txt>{sheet.reason}</Txt>
          {sheet.rows.map((r) => (
            <KeyValue key={r.label} label={r.label} value={r.value} />
          ))}
          {sheet.issues.map((m) => (
            <Hint key={m}>{m}</Hint>
          ))}
          {sheet.action ? (
            <Button
              label={sheet.action.label}
              variant="secondary"
              block
              onPress={() => {
                const href = sheet.action!.href;
                onClose();
                onAction(href);
              }}
            />
          ) : null}
        </View>
      ) : null}
    </Sheet>
  );
}
