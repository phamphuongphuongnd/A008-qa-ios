/**
 * S-02 rental card with swipe-left actions (Close · Reopen + Delete). The same actions are accessibility actions,
 * so TalkBack / VoiceOver users never need the gesture.
 */
import { Columns2, ListOrdered } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { font, useTheme } from '@/theme';
import { RentalCard, Txt } from '@/ui';

import type { RentalCard as RentalCardModel } from '../rentalQueries';
import { statusTone, swipeActions, swipeLabel, type SwipeAction } from '../screenModels';

export function SwipeRentalCard({
  card,
  onPress,
  onAction,
}: {
  card: RentalCardModel;
  onPress: () => void;
  onAction: (a: SwipeAction) => void;
}) {
  const { colors, radius } = useTheme();
  const ref = useRef<SwipeableMethods>(null);
  const actions = swipeActions(card.status);
  const run = (a: SwipeAction) => {
    ref.current?.close();
    onAction(a);
  };
  return (
    <View
      // One focusable element for screen readers: tap opens the hub, the swipe actions are custom actions.
      accessible
      accessibilityRole="button"
      accessibilityLabel={[card.address, card.city, card.statusLabel, card.line, card.modeLabel, card.summary.fullText].join(', ')}
      accessibilityActions={[{ name: 'activate' }, ...actions.map((a) => ({ name: a, label: swipeLabel(a) }))]}
      onAccessibilityAction={(e) => {
        const name = e.nativeEvent.actionName;
        if (name === 'activate') onPress();
        else run(name as SwipeAction);
      }}
    >
      <ReanimatedSwipeable
        ref={ref}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.actions}>
            {actions.map((a) => (
              <Pressable
                key={a}
                onPress={() => run(a)}
                accessibilityRole="button"
                accessibilityLabel={swipeLabel(a)}
                style={[
                  styles.action,
                  { borderRadius: radius.lg, backgroundColor: a === 'delete' ? colors.danger : a === 'close' ? colors.surface2 : colors.accentSoft },
                ]}
              >
                <Txt style={[font(600, 15, 20), { color: a === 'delete' ? colors.onDanger : a === 'close' ? colors.ink : colors.accent }]}>
                  {swipeLabel(a)}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
      >
        <RentalCard
          address={card.address}
          city={card.city}
          status={{ label: card.statusLabel, tone: statusTone(card.status) }}
          facts={card.line}
          mode={{ label: card.modeLabel, icon: card.reviewMode === 'compare' ? Columns2 : ListOrdered }}
          count={card.status === 'leased' ? card.summary.fullText : card.summary.countText}
          highlight={card.status === 'leased' ? undefined : (card.summary.detailText ?? undefined)}
          onPress={onPress}
        />
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'stretch', gap: 8, paddingLeft: 8 },
  action: { minWidth: 88, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
