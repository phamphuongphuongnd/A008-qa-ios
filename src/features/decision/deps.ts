/**
 * Real dependencies for 2D actions on the phone (screens import this; Jest builds its own with makeTestDb + fakes).
 */
import { db } from '@/db';
import { files } from '@/files';
import { expoQueueNotifier } from '@/notifications/queueTimersNative';

import type { DecisionDeps } from './decision';
import type { LetterDeps } from './letters';

export const decisionDeps: DecisionDeps = { db, notifier: expoQueueNotifier, now: () => new Date() };

export const letterDeps: LetterDeps = { db, files, now: () => new Date() };
