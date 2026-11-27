/**
 * Weekly automatic backup + reminder refresh in the background (expo-background-task / WorkManager / BGTaskScheduler).
 * TaskManager.defineTask must run at bundle load: index.ts imports this file above
 * 'expo-router/entry' (fact expo-native-v2-gotchas). Register with `registerBackupTask()` when automatic backup is
 * turned on, and at start.
 * Android: expo-background-task hard-codes a network constraint (WorkManager NetworkType.CONNECTED,
 * BackgroundTaskScheduler.kt) and needs ACCESS_NETWORK_STATE — offline / airplane mode it never runs, even for a
 * folder on the phone (B-76). So the weekly backup also runs whenever the app comes back to the front
 * (`registerBackupTask` → ./whenActive.ts); dropping the constraint itself needs a patch of the library (B-76 report).
 * Force a run: `adb shell cmd jobscheduler run -f -n androidx.work.systemjobscheduler <pkg> <jobId>`.
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import { ensureMigrated } from '@/db/migrate';
import { refreshReminders } from '@/notifications';

import { backupActions } from './index';
import { runWhenActive } from './whenActive';

export const BACKUP_TASK = 'evenlease-weekly';
/** Minutes between wake-ups (inexact); the backup itself runs once a week (autoBackupDue). */
const INTERVAL_MIN = 12 * 60;

if (!TaskManager.isTaskDefined(BACKUP_TASK)) {
  TaskManager.defineTask(BACKUP_TASK, async () => {
    try {
      await ensureMigrated();
      await backupActions.runAutoIfDue();
      await refreshReminders();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

let stopWhenActive: (() => void) | null = null;
function runWhenActiveOnce() {
  stopWhenActive ??= runWhenActive(() => backupActions.runAutoIfDue(), AppState);
}

/** Registers the periodic task once (the OS keeps it across restarts), and the run-on-return fallback. */
export async function registerBackupTask(): Promise<void> {
  runWhenActiveOnce();
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BACKUP_TASK)) return;
    await BackgroundTask.registerTaskAsync(BACKUP_TASK, { minimumInterval: INTERVAL_MIN });
  } catch {
    // Not available on this phone; weekly backup then runs when the app opens or comes back to the front.
  }
}
