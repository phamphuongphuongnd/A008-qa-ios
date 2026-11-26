/** Small shared parts of the 2D screens. */
import { FileQuestion } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { t } from '@/i18n';
import { router } from '@/services/router';
import { AppBar, EmptyState, Screen, Txt } from '@/ui';

export function NotFoundScreen({ title, message }: { title: string; message?: string }) {
  return (
    <Screen header={<AppBar title={title} />}>
      <EmptyState
        icon={FileQuestion}
        title={message ?? t('decision:s09.notFound')}
        primary={{ label: t('common:actions.back'), onPress: () => router.back() }}
      />
    </Screen>
  );
}

/** Muted line under a heading / button. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <Txt variant="caption" color="inkMuted">
      {children}
    </Txt>
  );
}

/** Route param → positive integer id, else null. */
export function idParam(v: string | string[] | undefined): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}
