import type { DisplaySession } from '@/features/display/domain/entities/display.types';
import { tokenNumber } from '@/features/display/presentation/components/display.view';

interface NowCallingBannerProps {
  session: DisplaySession;
}

/**
 * Shown for a few seconds after a token is called, so the hall notices the change (kept on the
 * redrawn board, client decision 1). The token is the plain number the board shows.
 */
export function NowCallingBanner({ session }: NowCallingBannerProps) {
  const where = session.room ? ` · Room ${session.room}` : '';
  return (
    <div
      role="alert"
      className="bg-p-500 rounded-board px-board-pad py-board-gap gap-board-pad flex flex-wrap items-baseline text-white"
    >
      <span className="text-board-subtitle">Now calling</span>
      <span className="text-board-token">{tokenNumber(session)}</span>
      <span className="text-board-subtitle">
        {session.doctorName}
        {where}
      </span>
    </div>
  );
}
