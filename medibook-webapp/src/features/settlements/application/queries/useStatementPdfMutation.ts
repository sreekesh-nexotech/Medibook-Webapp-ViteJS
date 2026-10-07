import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { fetchStatementPdf } from '@/features/settlements/application/usecases/fetchStatementPdf';

/**
 * A statement's PDF — a signed link, or the file from an older server. A
 * read, so nothing to invalidate; a mutation because each link is short-lived
 * and must never be served from cache.
 */
export function useStatementPdfMutation() {
  return useMutation({
    mutationFn: async (statementId: string) => unwrap(await fetchStatementPdf(statementId)),
  });
}
