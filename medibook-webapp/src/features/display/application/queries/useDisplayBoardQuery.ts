import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { displayKeys } from '@/features/display/application/queries/display.keys';
import { fetchDisplayBoard } from '@/features/display/application/usecases/fetchDisplayBoard';

/** How often the board refreshes — a called token reaches the hall within this. */
export const DISPLAY_POLL_MS = 15_000;

/** Today's queue for this screen, polled while it is open (also in a background tab). */
export function useDisplayBoardQuery(accessToken: string | undefined) {
  return useQuery({
    queryKey: displayKeys.board(accessToken ?? ''),
    queryFn: async () => unwrap(await fetchDisplayBoard(accessToken ?? '')),
    enabled: Boolean(accessToken),
    refetchInterval: DISPLAY_POLL_MS,
    refetchIntervalInBackground: true,
  });
}
