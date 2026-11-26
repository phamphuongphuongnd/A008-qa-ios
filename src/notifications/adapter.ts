/**
 * Local notifications (product.md §6) behind a small adapter: the phone's is native.ts (expo-notifications), Jest uses
 * `makeFakeNotifications()`. Shared by 2E reminders and 2D's First-come timers (`queueTimers*`).
 * Only local notifications — no push token, no network.
 */
export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Android channels (created at start by `setupNotifications`). Timers use their own so they can be muted apart. */
export const CHANNELS = { reminders: 'reminders', timers: 'timers' } as const;
export type ChannelId = (typeof CHANNELS)[keyof typeof CHANNELS];

export interface LocalNotification {
  /** Stable id: scheduling again with the same id replaces the old one. */
  id: string;
  title: string;
  body: string;
  /** When to show it. */
  at: Date;
  channel: ChannelId;
  /** In-app path opened on tap (a `routes.*` value). */
  url: string;
}

export interface NotificationAdapter {
  permission(): Promise<PermissionState>;
  /** Asks the system (shows the prompt once; later calls just return the state). */
  requestPermission(): Promise<PermissionState>;
  schedule(n: LocalNotification): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Ids of every scheduled notification. */
  scheduledIds(): Promise<string[]>;
  cancelAll(): Promise<void>;
}

/** In-memory adapter for tests. */
export function makeFakeNotifications(initial: PermissionState = 'granted') {
  let state = initial;
  const scheduled = new Map<string, LocalNotification>();
  let asked = 0;
  const adapter: NotificationAdapter = {
    async permission() {
      return state;
    },
    async requestPermission() {
      asked++;
      if (state === 'undetermined') state = 'granted';
      return state;
    },
    async schedule(n) {
      scheduled.set(n.id, n);
    },
    async cancel(id) {
      scheduled.delete(id);
    },
    async scheduledIds() {
      return [...scheduled.keys()];
    },
    async cancelAll() {
      scheduled.clear();
    },
  };
  return {
    adapter,
    scheduled,
    asked: () => asked,
    setPermission: (s: PermissionState) => {
      state = s;
    },
  };
}
