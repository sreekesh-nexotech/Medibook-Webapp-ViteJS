import type { DisplaySession } from '@/features/display/domain/entities/display.types';

interface NowCallingBannerProps {
  session: DisplaySession;
}

/** Shown for a few seconds after a token is called, so the hall notices the change. */
export function NowCallingBanner({ session }: NowCallingBannerProps) {
  const where = session.room ? ` · Room ${session.room}` : '';
  return (
    <div
      role="alert"
      className="bg-p-500 flex flex-wrap items-baseline gap-4 rounded-xl px-8 py-5 text-white"
    >
      <span className="text-h2">Now calling</span>
      <span className="text-display">{session.currentToken}</span>
      <span className="text-h2">
        {session.doctorName}
        {where}
      </span>
    </div>
  );
}
