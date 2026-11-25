import * as Haptics from 'expo-haptics';

/**
 * The only haptics in the app (product.md §5.0): tick on segmented / switch changes, success on Save / Decision,
 * error on a failed Save (with scroll to the first error + announcement).
 */
export const haptics = {
  tick: () => void Haptics.selectionAsync().catch(() => {}),
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};
