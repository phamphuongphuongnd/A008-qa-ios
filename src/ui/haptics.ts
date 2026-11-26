import * as Haptics from 'expo-haptics';

/** product.md §5.0: tick when a segmented control / choice changes, "success" on Save / Decision. Never throws. */
export const haptics = {
  tick: () => Haptics.selectionAsync().catch(() => {}),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
