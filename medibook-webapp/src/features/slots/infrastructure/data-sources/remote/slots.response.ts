import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  AffectedBooking,
  BulkSlotResult,
  DoctorSlotDay,
  ScheduledSlot,
  SlotGenerationRun,
  SlotRegenerateResult,
} from '@/features/slots/domain/entities/slots.entities';

/**
 * Response DTOs for `/hospital/slots…`. `schema.yml` types the grid, block,
 * open, bulk and regenerate bodies only as free-form objects; these shapes
 * follow `scheduling/services/slots.py` (`grid`, `_slot_row`, `block`, `bulk`,
 * `regenerate`) and `materialise._booking_ref`.
 */

/** `_slot_row` — `state` is `past` for a started open/blocked slot, else the status. */
export const slotResponseSchema = z.object({
  id: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  state: z.enum(['open', 'held', 'booked', 'blocked', 'past']),
  block_reason: z.string().nullable(),
  hold_expires_at: z.string().nullable().optional(),
  booking: z
    .object({
      appointment_id: z.string(),
      booking_ref: z.string(),
      token_label: z.string().nullable(),
      status: z.string(),
    })
    .nullable(),
});

type SlotResponse = z.infer<typeof slotResponseSchema>;

const doctorDayResponseSchema = z.object({
  doctor: z.object({
    id: z.string(),
    name: z.string(),
    department_id: z.string(),
    slot_length_min: z.number().int(),
  }),
  sessions: z.array(
    z.object({
      id: z.string(),
      // Optional so an older backend without them still parses.
      session_code: z.string().optional(),
      label: z.string(),
      status: z.string().optional(),
      starts_at: z.string(),
      ends_at: z.string(),
      slots: z.array(slotResponseSchema),
    }),
  ),
});

type DoctorDayResponse = z.infer<typeof doctorDayResponseSchema>;

/** `GET /slots` — one page of doctors (the paginated envelope). */
export const slotGridPageResponseSchema = paginatedSchema(doctorDayResponseSchema);

/** `POST /slots/{id}/block` — `{dry_run, slot, affected_bookings}`. */
export const slotBlockResponseSchema = z.object({
  dry_run: z.boolean(),
  slot: slotResponseSchema,
});

/** `materialise._booking_ref`. */
const affectedBookingResponseSchema = z.object({
  appointment_id: z.string(),
  booking_ref: z.string(),
  token_label: z.string().nullable(),
  patient_name: z.string(),
  scheduled_start_at: z.string(),
});

type AffectedBookingResponse = z.infer<typeof affectedBookingResponseSchema>;

/** `POST /slots/bulk` — the dry-run and the executed result share one shape. */
export const bulkSlotResponseSchema = z.object({
  dry_run: z.boolean(),
  action: z.enum(['block', 'open']),
  affected_count: z.number().int(),
  skipped_booked: z.number().int(),
  skipped_past: z.number().int(),
  affected_bookings: z.array(affectedBookingResponseSchema),
});

/** `POST /slots/regenerate` — `{run_id, …Result.as_dict()}`. */
export const regenerateResponseSchema = z.object({
  created_count: z.number().int(),
  updated_count: z.number().int(),
  closed_count: z.number().int(),
  preserved_count: z.number().int(),
});

/** `GenerationRun` (`schema.yml`). */
const generationRunResponseSchema = z.object({
  id: z.string(),
  doctor_id: z.string().nullable(),
  trigger: z.string(),
  horizon_from: z.string().nullable().optional(),
  horizon_to: z.string().nullable().optional(),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  created_count: z.number().int(),
  updated_count: z.number().int().optional(),
  closed_count: z.number().int().optional(),
  preserved_count: z.number().int().optional(),
  error: z.string().nullable(),
});

export const generationRunPageResponseSchema = paginatedSchema(generationRunResponseSchema);

export function toScheduledSlot(dto: SlotResponse): ScheduledSlot {
  return {
    id: dto.id,
    startsAt: dto.starts_at,
    endsAt: dto.ends_at,
    state: dto.state,
    blockReason: dto.block_reason,
    holdExpiresAt: dto.hold_expires_at ?? null,
    booking: dto.booking
      ? {
          appointmentId: dto.booking.appointment_id,
          bookingRef: dto.booking.booking_ref,
          tokenLabel: dto.booking.token_label,
          status: dto.booking.status,
        }
      : null,
  };
}

export function toDoctorSlotDay(dto: DoctorDayResponse): DoctorSlotDay {
  return {
    doctorId: dto.doctor.id,
    doctorName: dto.doctor.name,
    departmentId: dto.doctor.department_id,
    slotLengthMin: dto.doctor.slot_length_min,
    sessions: dto.sessions.map((s) => ({
      id: s.id,
      sessionCode: s.session_code ?? '',
      label: s.label,
      status: s.status ?? 'scheduled',
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      slots: s.slots.map(toScheduledSlot),
    })),
  };
}

function toAffectedBooking(dto: AffectedBookingResponse): AffectedBooking {
  return {
    appointmentId: dto.appointment_id,
    bookingRef: dto.booking_ref,
    tokenLabel: dto.token_label,
    patientName: dto.patient_name,
    scheduledStartAt: dto.scheduled_start_at,
  };
}

export function toBulkSlotResult(dto: z.infer<typeof bulkSlotResponseSchema>): BulkSlotResult {
  return {
    isDryRun: dto.dry_run,
    action: dto.action,
    affectedCount: dto.affected_count,
    skippedBooked: dto.skipped_booked,
    skippedPast: dto.skipped_past,
    affectedBookings: dto.affected_bookings.map(toAffectedBooking),
  };
}

export function toRegenerateResult(
  dto: z.infer<typeof regenerateResponseSchema>,
): SlotRegenerateResult {
  return {
    createdCount: dto.created_count,
    updatedCount: dto.updated_count,
    closedCount: dto.closed_count,
    preservedCount: dto.preserved_count,
  };
}

export function toGenerationRun(
  dto: z.infer<typeof generationRunResponseSchema>,
): SlotGenerationRun {
  return {
    id: dto.id,
    doctorId: dto.doctor_id,
    trigger: dto.trigger,
    horizonFrom: dto.horizon_from ?? null,
    horizonTo: dto.horizon_to ?? null,
    startedAt: dto.started_at,
    finishedAt: dto.finished_at,
    createdCount: dto.created_count,
    updatedCount: dto.updated_count ?? 0,
    closedCount: dto.closed_count ?? 0,
    preservedCount: dto.preserved_count ?? 0,
    error: dto.error,
  };
}
