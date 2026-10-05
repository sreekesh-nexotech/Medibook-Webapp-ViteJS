import { useMutation } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { fetchStatementPdf } from '@/features/settlements/application/usecases/fetchStatementPdf';

/**
 * Render a statement PDF on demand (statements with no stored file). A read,
 * so nothing to invalidate; a mutation because the user triggers a one-off file.
 */
export function useStatementPdfMutation() {
  return useMutation({
    mutationFn: async (statementId: string) => unwrap(await fetchStatementPdf(statementId)),
  });
}
