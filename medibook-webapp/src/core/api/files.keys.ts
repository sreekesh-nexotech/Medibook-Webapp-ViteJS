/** Query keys for the shared files API (standards §4 — no inline key arrays). */
export const filesKeys = {
  all: ['files'] as const,
  detail: (fileId: string) => [...filesKeys.all, 'detail', fileId] as const,
};
