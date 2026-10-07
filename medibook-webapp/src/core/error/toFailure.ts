import { isAxiosError } from 'axios';
import { z } from 'zod';

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
  server: 'Something went wrong on our side. Please try again.',
  parse: 'The server sent an unexpected response. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * Codes whose server sentence is replaced with one that says what still
 * works. The tenant gate refuses every hospital write with these before RBAC
 * runs (D-30, `subscriptions/services/gate.py`), so the user must not read
 * them as a permission problem (UAT-38).
 */
export const HOSPITAL_WRITE_BLOCK_CODES = ['HOSPITAL_READ_ONLY', 'HOSPITAL_SUSPENDED'] as const;

export type HospitalWriteBlockCode = (typeof HOSPITAL_WRITE_BLOCK_CODES)[number];

const CODE_MESSAGES: Readonly<Record<HospitalWriteBlockCode, string>> = {
  HOSPITAL_READ_ONLY:
    "This hospital is read-only until its Medibook subscription is paid. You can still view everything; changes can't be saved.",
  HOSPITAL_SUSPENDED:
    "This hospital is suspended by Medibook operations. You can still view everything; changes can't be saved. Contact support@medibook.in.",
};

/** Whether `failure` is the tenant gate refusing a write (read-only or suspended hospital). */
export function isHospitalWriteBlock(failure: Failure): boolean {
  return (HOSPITAL_WRITE_BLOCK_CODES as readonly (string | null)[]).includes(failure.code);
}

function codeMessage(code: string | undefined): string | undefined {
  return code !== undefined && code in CODE_MESSAGES
    ? CODE_MESSAGES[code as HospitalWriteBlockCode]
    : undefined;
}

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

function kindForStatus(status: number): FailureKind {
  if (status === HTTP_BAD_REQUEST) return 'validation';
  if (status === HTTP_UNAUTHORIZED) return 'unauthorized';
  if (status === HTTP_FORBIDDEN) return 'forbidden';
  if (status === HTTP_NOT_FOUND) return 'notFound';
  if (status === HTTP_CONFLICT || status === HTTP_PRECONDITION_FAILED) return 'conflict';
  if (status === HTTP_LOCKED || status === HTTP_TOO_MANY_REQUESTS) return 'rateLimited';
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
 * generic sentence so no internal detail ever reaches the UI.
 */
export function toFailure(error: unknown): Failure {
  if (isFailure(error)) return error;

  if (error instanceof z.ZodError) return failure('parse');

  if (isAxiosError(error)) {
    const response = error.response;
    if (!response) return failure('network');

    const kind = kindForStatus(response.status);
    const parsed = errorEnvelopeSchema.safeParse(response.data);
    if (!parsed.success) return failure(kind, { status: response.status });

    const body = parsed.data;
    const isServerSide = kind === 'server';
    return failure(kind, {
      status: response.status,
      code: body.code ?? null,
      message:
        codeMessage(body.code) ??
        (!isServerSide && body.message ? body.message : FALLBACK_MESSAGES[kind]),
      fieldErrors: toFieldErrors(body.errors),
      requestId: body.request_id ?? null,
      meta: body.meta ?? {},
    });
  }

  return failure('unknown');
}

/** A failure built in the client (no request made), e.g. a file over the size limit. */
export function clientFailure(kind: FailureKind, message: string, code: string | null = null) {
  return failure(kind, { message, code });
}
