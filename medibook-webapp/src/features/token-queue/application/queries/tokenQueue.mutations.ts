import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type {
  SessionCommand,
  TokenCommand,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';
import { applySession } from '@/features/token-queue/application/queries/tokenQueue.cache';
import { runSessionCommand } from '@/features/token-queue/application/usecases/tokenQueue.runSessionCommand';
import { runTokenCommand } from '@/features/token-queue/application/usecases/tokenQueue.runTokenCommand';
import { skipToken } from '@/features/token-queue/application/usecases/tokenQueue.skipToken';

interface SessionCommandInput {
  readonly sessionId: string;
  readonly command: SessionCommand;
}

/** open · call-next · pause · resume · close. */
export function useSessionCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, command }: SessionCommandInput) =>
      unwrap(await runSessionCommand(sessionId, command)),
    onSuccess: (session) => applySession(queryClient, session),
  });
}

interface TokenCommandInput {
  readonly sessionId: string;
  readonly command: TokenCommand;
  readonly tokenNo: number;
}

/** serve · complete · no-show (and call / recall) on one token. */
export function useTokenCommandMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, command, tokenNo }: TokenCommandInput) =>
      unwrap(await runTokenCommand(sessionId, command, tokenNo)),
    onSuccess: (session) => applySession(queryClient, session),
  });
}

interface SkipInput {
  readonly sessionId: string;
  readonly tokenNo: number;
}

/** Skip the current token; the outcome says whether to offer a no-show. */
export function useSkipTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sessionId, tokenNo }: SkipInput) =>
      unwrap(await skipToken(sessionId, tokenNo)),
    onSuccess: (outcome) => applySession(queryClient, outcome.session),
  });
}
