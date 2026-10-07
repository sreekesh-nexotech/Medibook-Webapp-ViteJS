import { z } from 'zod';

/**
 * Masked contact details the backend puts next to a name on audit and
 * compliance rows (B6 `audit/services/labels.py`: `<prefix>_contact =
 * {email, phone}`). Accepts a plain string too, so a backend that flattens
 * it still parses.
 */
export const maskedContactSchema = z
  .union([
    z.string(),
    z.object({
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    }),
  ])
  .nullable()
  .optional();

export type MaskedContactDto = z.infer<typeof maskedContactSchema>;

/** One display line, e.g. `"+91******10 · a***@x.in"`; `null` when nothing is known. */
export function toContactLine(dto: MaskedContactDto): string | null {
  if (dto === null || dto === undefined) return null;
  if (typeof dto === 'string') return dto.trim() === '' ? null : dto;
  const parts = [dto.phone, dto.email].filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' · ') : null;
}
