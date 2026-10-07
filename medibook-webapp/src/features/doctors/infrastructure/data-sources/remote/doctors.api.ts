import { idempotencyKey, ifMatch } from '@/core/api/headers';
import { hospitalApi } from '@/core/api/http';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, paginatedSchema } from '@/core/api/pagination';

import type {
  DateExceptionInput,
  DepartmentInput,
  DoctorFilters,
  DoctorInput,
  LeaveInput,
  ScheduleWriteMode,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import type {
  DepartmentResponse,
  DoctorResponse,
  ScheduleChangeResponse,
  ScheduleResponse,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';
import {
  dateExceptionSchema,
  departmentResponseSchema,
  doctorResponseSchema,
  doctorReviewResponseSchema,
  leaveSchema,
  scheduleChangeResponseSchema,
  scheduleResponseSchema,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';

/**
 * Doctors & Departments endpoints (`/api/v1/hospital/…`). Lists are
 * paginated server-side (despite `schema.yml` typing them as arrays); the
 * catalogue is small, so every page is fetched. Writes that can cancel
 * bookings take a `ScheduleWriteMode`: `?confirm=`, the caller's
 * `Idempotency-Key` and, on confirm, the dry run's preview token.
 */

export const departmentPageSchema = paginatedSchema(departmentResponseSchema);
export const doctorPageSchema = paginatedSchema(doctorResponseSchema);
export const leavePageSchema = paginatedSchema(leaveSchema);
export const dateExceptionPageSchema = paginatedSchema(dateExceptionSchema);
export const doctorReviewPageSchema = paginatedSchema(doctorReviewResponseSchema);

/**
 * Query parameter that carries the dry run's preview token on confirm
 * (BE-33: confirm is refused with 409 when the affected bookings changed).
 */
export const PREVIEW_TOKEN_PARAM = 'preview_token';

/** `?confirm=` plus the preview token on confirm (only when the dry run issued one). */
function writeParams(mode: ScheduleWriteMode) {
  return {
    confirm: mode.confirm,
    ...(mode.confirm && mode.previewToken ? { [PREVIEW_TOKEN_PARAM]: mode.previewToken } : {}),
  };
}

/** The write's replay key, plus `If-Match` when the row is versioned. */
function writeHeaders(mode: ScheduleWriteMode, version?: number) {
  return {
    ...(version === undefined ? {} : ifMatch(version)),
    ...idempotencyKey(mode.idempotencyKey),
  };
}

/** Fetch every page of a list, in order. */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ results: T[]; has_next: boolean }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const data = await fetchPage(page);
    rows.push(...data.results);
    if (!data.has_next) return rows;
  }
}

/* ---------------------------------------------------------------- departments */

export function getDepartments(): Promise<DepartmentResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/departments', {
      params: { page, page_size: MAX_PAGE_SIZE },
    });
    return departmentPageSchema.parse(response.data);
  });
}

/** `code` only when the user typed one — the server makes it otherwise (BE-33, UAT-49). */
function departmentBody(input: DepartmentInput) {
  return {
    name: input.name,
    description: input.description || null,
    is_active: input.isActive,
    ...(input.code !== undefined && { code: input.code }),
  };
}

export async function postDepartment(input: DepartmentInput): Promise<DepartmentResponse> {
  const response = await hospitalApi.post('/departments', departmentBody(input));
  return departmentResponseSchema.parse(response.data);
}

/** `update_department` calls `require_version`: `If-Match` is mandatory (UAT-06). */
export async function patchDepartment(
  id: string,
  input: DepartmentInput,
  version: number,
): Promise<DepartmentResponse> {
  const response = await hospitalApi.patch(
    `/departments/${encodeURIComponent(id)}`,
    departmentBody(input),
    { headers: ifMatch(version) },
  );
  return departmentResponseSchema.parse(response.data);
}

export async function deleteDepartment(id: string): Promise<void> {
  await hospitalApi.delete(`/departments/${encodeURIComponent(id)}`);
}

/* -------------------------------------------------------------------- doctors */

export function getDoctors(filters: DoctorFilters): Promise<DoctorResponse[]> {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get('/doctors', {
      params: {
        page,
        page_size: MAX_PAGE_SIZE,
        // The backend's free-text parameter is `q` (`search` is rejected).
        q: filters.search || undefined,
        department_id: filters.departmentId,
        status: filters.status,
      },
    });
    return doctorPageSchema.parse(response.data);
  });
}

export async function getDoctor(id: string): Promise<DoctorResponse> {
  const response = await hospitalApi.get(`/doctors/${encodeURIComponent(id)}`);
  return doctorResponseSchema.parse(response.data);
}

function doctorBody(input: DoctorInput) {
  return {
    name: input.name,
    title: input.title || null,
    department_id: input.departmentId,
    specialisation: input.specialisation,
    qualification: input.qualification || null,
    registration_no: input.registrationNo || null,
    experience_years: input.experienceYears,
    bio: input.bio || null,
    room: input.room || null,
    // Integer paise end to end: ₹499.50 is 49950, never re-derived from rupees (UAT-08).
    consultation_fee_paise: input.feePaise,
    follow_up_fee_paise: input.followUpFeePaise,
    expected_consult_minutes: input.expectedConsultMinutes,
    slot_length_min: input.slotLengthMin,
    is_bookable_online: input.isBookableOnline,
    status: input.status,
    photo_file_id: input.photoFileId,
    // Only a slug the user typed; the server makes one from the name (BE-33, UAT-49).
    ...(input.slug !== undefined && { slug: input.slug }),
  };
}

export async function postDoctor(input: DoctorInput): Promise<DoctorResponse> {
  const response = await hospitalApi.post('/doctors', doctorBody(input));
  return doctorResponseSchema.parse(response.data);
}

export async function patchDoctor(
  id: string,
  input: DoctorInput,
  version: number,
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(
    `/doctors/${encodeURIComponent(id)}`,
    doctorBody(input),
    { params: writeParams(mode), headers: writeHeaders(mode, version) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteDoctor(
  id: string,
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(`/doctors/${encodeURIComponent(id)}`, {
    params: writeParams(mode),
    headers: writeHeaders(mode),
  });
  return scheduleChangeResponseSchema.parse(response.data);
}

/** One page of a doctor's approved reviews, newest first (DOC-01). */
export async function getDoctorReviews(doctorId: string, page: number) {
  const response = await hospitalApi.get(`/doctors/${encodeURIComponent(doctorId)}/reviews`, {
    params: { page, page_size: DEFAULT_PAGE_SIZE },
  });
  return doctorReviewPageSchema.parse(response.data);
}

/* ------------------------------------------------------------------- schedule */

export async function getSchedule(doctorId: string): Promise<ScheduleResponse> {
  const response = await hospitalApi.get(`/doctors/${encodeURIComponent(doctorId)}/schedule`);
  return scheduleResponseSchema.parse(response.data);
}

/**
 * Every leave entry of a doctor, past ones included (the schedule read returns
 * only current and future leave), newest first.
 */
export function getLeaves(doctorId: string) {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get(`/doctors/${encodeURIComponent(doctorId)}/leaves`, {
      params: { page, page_size: MAX_PAGE_SIZE, sort: '-date_from' },
    });
    return leavePageSchema.parse(response.data);
  });
}

/** Every date exception of a doctor, past ones included, newest first. */
export function getDateExceptions(doctorId: string) {
  return fetchAllPages(async (page) => {
    const response = await hospitalApi.get(
      `/doctors/${encodeURIComponent(doctorId)}/date-exceptions`,
      { params: { page, page_size: MAX_PAGE_SIZE, sort: '-date' } },
    );
    return dateExceptionPageSchema.parse(response.data);
  });
}

export async function putWeeklySessions(
  doctorId: string,
  sessions: readonly WeeklySession[],
  version: number,
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.put(
    `/doctors/${encodeURIComponent(doctorId)}/weekly-sessions`,
    {
      sessions: sessions.map((s) => ({
        weekday: s.weekday,
        session_code: s.sessionCode,
        label: s.label,
        starts_at: s.startsAt,
        ends_at: s.endsAt,
        is_active: true,
      })),
    },
    { params: writeParams(mode), headers: writeHeaders(mode, version) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

function leaveBody(input: LeaveInput) {
  return {
    leave_type: input.kind,
    date_from: input.dateFrom,
    date_to: input.dateTo,
    reason: input.reason || null,
  };
}

export async function postLeave(
  doctorId: string,
  input: LeaveInput,
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.post(
    `/doctors/${encodeURIComponent(doctorId)}/leaves`,
    leaveBody(input),
    { params: writeParams(mode), headers: writeHeaders(mode) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function patchLeave(
  doctorId: string,
  leaveId: string,
  input: LeaveInput,
  version: number,
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(
    `/doctors/${encodeURIComponent(doctorId)}/leaves/${encodeURIComponent(leaveId)}`,
    leaveBody(input),
    { params: writeParams(mode), headers: writeHeaders(mode, version) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteLeave(
  doctorId: string,
  leave: { readonly id: string; readonly version: number },
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  // DELETE honours `If-Match` when sent (`check_version_if_sent`): a stale row is refused.
  const response = await hospitalApi.delete(
    `/doctors/${encodeURIComponent(doctorId)}/leaves/${encodeURIComponent(leave.id)}`,
    { params: writeParams(mode), headers: writeHeaders(mode, leave.version) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

function exceptionBody(input: DateExceptionInput) {
  return {
    date: input.date,
    kind: input.kind,
    note: input.note || null,
    sessions:
      input.kind === 'closed'
        ? []
        : input.sessions.map((s) => ({
            session_code: s.sessionCode,
            label: s.label,
            starts_at: s.startsAt,
            ends_at: s.endsAt,
          })),
  };
}

export async function postDateException(
  doctorId: string,
  input: DateExceptionInput,
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.post(
    `/doctors/${encodeURIComponent(doctorId)}/date-exceptions`,
    exceptionBody(input),
    { params: writeParams(mode), headers: writeHeaders(mode) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function patchDateException(
  doctorId: string,
  exceptionId: string,
  input: DateExceptionInput,
  version: number,
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.patch(
    `/doctors/${encodeURIComponent(doctorId)}/date-exceptions/${encodeURIComponent(exceptionId)}`,
    exceptionBody(input),
    { params: writeParams(mode), headers: writeHeaders(mode, version) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}

export async function deleteDateException(
  doctorId: string,
  exception: { readonly id: string; readonly version: number },
  mode: ScheduleWriteMode,
): Promise<ScheduleChangeResponse> {
  const response = await hospitalApi.delete(
    `/doctors/${encodeURIComponent(doctorId)}/date-exceptions/${encodeURIComponent(exception.id)}`,
    { params: writeParams(mode), headers: writeHeaders(mode, exception.version) },
  );
  return scheduleChangeResponseSchema.parse(response.data);
}
