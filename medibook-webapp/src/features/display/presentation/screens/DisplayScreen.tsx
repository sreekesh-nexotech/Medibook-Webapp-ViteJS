import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { Spinner } from '@/shared/ui/Spinner';

import { isFailure } from '@/core/error/failure';

import { DISPLAY_KEY_PARAM } from '@/app/router/paths';

import type { DisplaySession } from '@/features/display/domain/entities/display.types';
import { useDisplayBoardQuery } from '@/features/display/application/queries/useDisplayBoardQuery';
import { useDisplayGrantQuery } from '@/features/display/application/queries/useDisplayGrantQuery';
import {
  forgetDisplayKey,
  rememberDisplayKey,
  storedDisplayKey,
} from '@/features/display/application/usecases/displayKey';
import { DisplayKeyForm } from '@/features/display/presentation/components/DisplayKeyForm';
import { NowCallingBanner } from '@/features/display/presentation/components/NowCallingBanner';
import { DisplaySessionTile } from '@/features/display/presentation/components/DisplaySessionTile';
import {
  boardDateLabel,
  latestCall,
  orderSessions,
} from '@/features/display/presentation/components/display.view';

const HTTP_UNAUTHORIZED = 401;

/** How long the "Now calling" banner stays up after a call. */
const NOW_CALLING_MS = 12_000;

/**
 * The waiting-room display (UAT PRV-010 / DEF-006): a public page for the TV
 * in the OPD hall. It signs in with a device key (from `?key=` or typed once,
 * then kept in this browser) and shows today's token for every doctor
 * session, refreshed every 15 seconds. No staff session is involved.
 */
export function DisplayScreen() {
  const [params, setParams] = useSearchParams();
  const [deviceKey, setDeviceKey] = useState<string | null>(
    () => params.get(DISPLAY_KEY_PARAM) ?? storedDisplayKey(),
  );
  const grant = useDisplayGrantQuery(deviceKey);
  const board = useDisplayBoardQuery(grant.data?.accessToken);
  const [calling, setCalling] = useState<DisplaySession | null>(null);
  // The first board only sets the baseline: a call made before the screen
  // opened is not announced.
  const [seenCallAt, setSeenCallAt] = useState<string | null | undefined>(undefined);

  // A key from the URL is kept, then dropped from the address bar.
  useEffect(() => {
    if (!params.has(DISPLAY_KEY_PARAM)) return;
    setParams({}, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if (grant.isSuccess && deviceKey) rememberDisplayKey(deviceKey);
  }, [grant.isSuccess, deviceKey]);

  // Compare each new board with the last one while rendering (React's
  // "adjust state when props change" pattern) rather than in an effect.
  const sessionsNow = board.data?.sessions;
  const [boardSeen, setBoardSeen] = useState(sessionsNow);
  if (sessionsNow && sessionsNow !== boardSeen) {
    setBoardSeen(sessionsNow);
    if (seenCallAt === undefined) {
      setSeenCallAt(latestCall(sessionsNow, null)?.lastCalledAt ?? null);
    } else {
      const fresh = latestCall(sessionsNow, seenCallAt);
      if (fresh) {
        setSeenCallAt(fresh.lastCalledAt);
        setCalling(fresh);
      }
    }
  }

  useEffect(() => {
    if (!calling) return;
    const timer = window.setTimeout(() => setCalling(null), NOW_CALLING_MS);
    return () => window.clearTimeout(timer);
  }, [calling]);

  // The token was revoked or expired early: mint a new one.
  const boardStatus = isFailure(board.error) ? board.error.status : null;
  const { refetch: renewGrant } = grant;
  useEffect(() => {
    if (boardStatus === HTTP_UNAUTHORIZED) void renewGrant();
  }, [boardStatus, renewGrant]);

  if (!deviceKey || grant.isError) {
    const message =
      grant.isError && isFailure(grant.error)
        ? `This key did not work: ${grant.error.message}`
        : null;
    return (
      <DisplayKeyForm
        busy={grant.isFetching}
        error={message}
        onSubmit={(key) => {
          forgetDisplayKey();
          setDeviceKey(key);
        }}
      />
    );
  }

  if (!board.data) {
    return (
      <main className="bg-bg-app flex h-full items-center justify-center">
        <Spinner />
      </main>
    );
  }

  const sessions = orderSessions(board.data.sessions);
  return (
    <main className="bg-bg-app flex h-full flex-col gap-6 overflow-y-auto p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-display text-text-strong">{board.data.hospitalName}</h1>
        <p className="text-h3 text-text-muted">{boardDateLabel(board.data.date)}</p>
      </header>
      {calling ? <NowCallingBanner session={calling} /> : null}
      {board.isError ? (
        <p role="status" className="text-body text-warning">
          Reconnecting… the tokens below may be a little out of date.
        </p>
      ) : null}
      {sessions.length === 0 ? (
        <p className="text-h2 text-text-muted">No consultations are running today.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((session) => (
            <DisplaySessionTile key={session.id} session={session} />
          ))}
        </div>
      )}
    </main>
  );
}
