/** Query keys for the waiting-room display (standards §4 — no inline key arrays). */
export const displayKeys = {
  all: ['display'] as const,
  /** The display token minted from one device key. */
  grant: (deviceKey: string) => [...displayKeys.all, 'grant', deviceKey] as const,
  /** Today's board, read with one display token. */
  board: (accessToken: string) => [...displayKeys.all, 'board', accessToken] as const,
};
