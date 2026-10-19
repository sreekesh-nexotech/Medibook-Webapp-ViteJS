import { cn } from '@/shared/lib/cn';

import type { DisplaySession } from '@/features/display/domain/entities/display.types';
import {
  sessionStateLabel,
  waitingLabel,
} from '@/features/display/presentation/components/display.view';

interface DisplaySessionTileProps {
  session: DisplaySession;
}

/** One doctor's queue on the hall screen: who is being seen now and how many wait. */
export function DisplaySessionTile({ session }: DisplaySessionTileProps) {
  const live = session.status === 'open' && Boolean(session.currentToken);
  const where = [session.room && `Room ${session.room}`, session.counterCode]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      className={cn(
        'bg-bg-surface flex flex-col gap-4 rounded-xl border p-6',
        live ? 'border-p-500' : 'border-border',
        session.status === 'closed' && 'opacity-60',
      )}
      aria-label={`${session.doctorName}, ${sessionStateLabel(session)}`}
    >
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-h2 text-text-strong truncate">{session.doctorName}</h2>
          <p className="text-body text-text-muted">
            {[session.label, where].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="bg-bg-tint text-label text-text-navy shrink-0 rounded-sm px-3 py-1">
          {waitingLabel(session.waitingCount)}
        </span>
      </header>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-label text-text-muted">{sessionStateLabel(session)}</p>
          <p
            className={cn('text-display', live ? 'text-p-600' : 'text-text-faint')}
            aria-live="polite"
          >
            {session.currentToken ?? '—'}
          </p>
        </div>
        {session.currentPatient ? (
          <p className="text-h3 text-text-body truncate">{session.currentPatient}</p>
        ) : null}
      </div>
    </article>
  );
}
