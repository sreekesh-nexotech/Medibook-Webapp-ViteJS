import { isAxiosError } from 'axios';
import type { AxiosError } from 'axios';
import { z } from 'zod';

import { REQUEST_ID_HEADER } from '@/core/config/api';

import type { Failure, FailureKind, FieldErrors } from '@/core/error/failure';
import { isFailure } from '@/core/error/failure';

/** Shown when nothing more specific is safe to say. */
const FALLBACK_MESSAGES: Readonly<Record<FailureKind, string>> = {
  network: 'Could not reach the server. Check your connection and try again.',
  validation: 'Some details need fixing. Check the highlighted fields.',
  unauthorized: 'Your session has ended. Please sign in again.',
  forbidden: 'You do not have permission to do that.',
  notFound: 'That record could not be found.',
  conflict: 'This record changed in the meantime. Refresh and try again.',
  rateLimited: 'Too many attempts. Please wait a moment and try again.',
  unavailable: "This isn't available in Medibook yet.",
  server: 'Something went wrong on our side. Please try again.',
  parse: 'The server sent an unexpected response. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * The backend's single error envelope `{code, message, errors, request_id,
 * meta}` (backend `core/exceptions.py`). Lenient: every field is optional so a
 * proxy's HTML error page still maps to a status-based failure.
 */
const errorEnvelopeSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  errors: z.record(z.string(), z.unknown()).optional(),
  request_id: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_PRECONDITION_FAILED = 412;
const HTTP_LOCKED = 423;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;
const HTTP_NOT_IMPLEMENTED = 501;

function kindForStatus(status: number): FailureKind {
  if (status === HTTP_BAD_REQUEST) return 'validation';
  if (status === HTTP_UNAUTHORIZED) return 'unauthorized';
  if (status === HTTP_FORBIDDEN) return 'forbidden';
  if (status === HTTP_NOT_FOUND) return 'notFound';
  if (status === HTTP_CONFLICT || status === HTTP_PRECONDITION_FAILED) return 'conflict';
  if (status === HTTP_LOCKED || status === HTTP_TOO_MANY_REQUESTS) return 'rateLimited';
  if (status === HTTP_NOT_IMPLEMENTED) return 'unavailable';
  if (status >= HTTP_SERVER_ERROR_MIN) return 'server';
  return 'unknown';
}

/** DRF nests messages as strings, lists, or objects; flatten to string lists. */
function toFieldErrors(raw: Readonly<Record<string, unknown>> | undefined): FieldErrors {
  if (!raw) return {};
  const out: Record<string, readonly string[]> = {};
  for (const [field, value] of Object.entries(raw)) {
    const list = Array.isArray(value) ? value : [value];
    const messages = list.filter((m): m is string => typeof m === 'string');
    if (messages.length > 0) out[field] = messages;
  }
  return out;
}

/**
 * The id support can look up: the one the backend answered with (envelope or
 * header), else the one this request was sent with — a request that timed out
 * may still have reached the server and its logs.
 */
function requestIdOf(error: AxiosError, envelopeId: string | null | undefined): string | null {
  if (envelopeId) return envelopeId;
  const answered: unknown = error.response?.headers[REQUEST_ID_HEADER.toLowerCase()];
  if (typeof answered === 'string' && answered) return answered;
  const sent: unknown = error.config?.headers.get(REQUEST_ID_HEADER);
  return typeof sent === 'string' && sent ? sent : null;
}

function failure(kind: FailureKind, partial: Partial<Failure> = {}): Failure {
  return {
    kind,
    message: FALLBACK_MESSAGES[kind],
    code: null,
    status: null,
    fieldErrors: {},
    requestId: null,
    meta: {},
    ...partial,
  };
}

/**
 * Convert anything thrown below the application layer into a `Failure`.
 *
 * Backend messages are the curated, user-facing sentences of its error table
 * (`core/errors.py`), so 4xx messages are passed through; 5xx always uses the
 * generic sentence so no internal detail ever reaches the UI. A 501's own
 * message is written for developers ("part of the contract but not built
 * yet"), so it gets the plain "not available" sentence too.
 */
export function toFailure(error: unknown): Failure {
  if (isFailure(error)) return error;

  if (error instanceof z.ZodError) return failure('parse');

  if (isAxiosError(error)) {
    const response = error.response;
    if (!response) return failure('network', { requestId: requestIdOf(error, null) });

    const kind = kindForStatus(response.status);
    const parsed = errorEnvelopeSchema.safeParse(response.data);
    if (!parsed.success) {
      return failure(kind, { status: response.status, requestId: requestIdOf(error, null) });
    }

    const body = parsed.data;
    const isServerSide = kind === 'server' || kind === 'unavailable';
    return failure(kind, {
      status: response.status,
      code: body.code ?? null,
      message: !isServerSide && body.message ? body.message : FALLBACK_MESSAGES[kind],
      fieldErrors: toFieldErrors(body.errors),
      requestId: requestIdOf(error, body.request_id),
      meta: body.meta ?? {},
    });
  }

  return failure('unknown');
}

/** A failure built in the client (no request made), e.g. a file over the size limit. */
export function clientFailure(kind: FailureKind, message: string, code: string | null = null) {
  return failure(kind, { message, code });
}
