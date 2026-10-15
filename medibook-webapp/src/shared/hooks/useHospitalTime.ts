import { useMemo } from 'react';

import { activeSurface } from '@/core/api/surface';
import { useNow } from '@/shared/hooks/useNow';
import { DEFAULT_HOSPITAL_TIME_ZONE, safeTimeZone, todayIn } from '@/shared/lib/hospitalTime';

import { useSessionQuery } from '@/features/auth/application/queries/useSessionQuery';

/** "Today" is re-read once a minute, so a screen left open over midnight rolls over. */
const TODAY_TICK_MS = 60_000;

/**
 * The signed-in hospital's IANA zone (`hospitals.timezone` from
 * `GET /hospital/me`, D-09). Falls back to the backend's own default zone
 * when the session has none — never to the PC's zone (UAT-47).
 */
export function useHospitalTimeZone(): string {
  const isHospital = activeSurface() === 'hospital';
  const { data: session } = useSessionQuery('hospital', isHospital);
  const zone = session?.surface === 'hospital' ? session.hospital.timeZone : null;
  return useMemo(() => (zone ? safeTimeZone(zone) : DEFAULT_HOSPITAL_TIME_ZONE), [zone]);
}

/** The hospital's zone and its "today" (`yyyy-mm-dd`), kept current across midnight. */
export function useHospitalToday(): { readonly timeZone: string; readonly today: string } {
  const timeZone = useHospitalTimeZone();
  const now = useNow(TODAY_TICK_MS);
  const today = todayIn(timeZone, now);
  return useMemo(() => ({ timeZone, today }), [timeZone, today]);
}
