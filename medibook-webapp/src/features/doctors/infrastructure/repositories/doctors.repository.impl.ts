import { getFileUrl } from '@/core/api/files.api';
import { attempt } from '@/core/error/attempt';
import { ok } from '@/core/error/failure';

import type {
  DoctorProfile,
  ScheduleChange,
} from '@/features/doctors/domain/entities/doctors.types';
import type { DoctorsRepository } from '@/features/doctors/domain/repositories/doctors.repository';
import * as api from '@/features/doctors/infrastructure/data-sources/remote/doctors.api';
import type { ScheduleChangeResponse } from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';
import {
  doctorResponseSchema,
  toAffectedBookings,
  toDepartment,
  toDoctor,
  toDoctorReview,
  toDateException,
  toLeave,
  toNotCancellableBookings,
  toSchedule,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';

/** The envelope without its `result` (the endpoints whose result the app does not use). */
function toChange(dto: ScheduleChangeResponse): ScheduleChange {
  return {
    dryRun: dto.dry_run,
    affectedBookings: toAffectedBookings(dto),
    notCancellableBookings: toNotCancellableBookings(dto),
    result: null,
    previewToken: dto.preview_token ?? null,
    rematerialisationQueued: dto.rematerialisation_queued ?? false,
  };
}

/** The doctor PATCH envelope — `result` is the updated doctor once applied. */
function toDoctorChange(dto: ScheduleChangeResponse): ScheduleChange<DoctorProfile> {
  return {
    ...toChange(dto),
    result: dto.result == null ? null : toDoctor(doctorResponseSchema.parse(dto.result)),
  };
}

export const doctorsRepository: DoctorsRepository = {
  listDepartments: () => attempt(async () => (await api.getDepartments()).map(toDepartment)),
  createDepartment: (input) => attempt(async () => toDepartment(await api.postDepartment(input))),
  updateDepartment: (id, input, version) =>
    attempt(async () => toDepartment(await api.patchDepartment(id, input, version))),
  deleteDepartment: (id) =>
    attempt(async () => {
      await api.deleteDepartment(id);
      return null;
    }),

  listDoctors: (filters) => attempt(async () => (await api.getDoctors(filters)).map(toDoctor)),
  getDoctor: (id) => attempt(async () => toDoctor(await api.getDoctor(id))),
  createDoctor: (input) => attempt(async () => toDoctor(await api.postDoctor(input))),
  updateDoctor: (id, input, version, mode) =>
    attempt(async () => toDoctorChange(await api.patchDoctor(id, input, version, mode))),
  deleteDoctor: (id, mode) => attempt(async () => toChange(await api.deleteDoctor(id, mode))),

  getPhotoUrl: async (fileId) => {
    const signed = await getFileUrl(fileId);
    return signed.ok ? ok(signed.data.url) : signed;
  },

  listReviews: (doctorId, page) =>
    attempt(async () => {
      const dto = await api.getDoctorReviews(doctorId, page);
      return { items: dto.results.map(toDoctorReview), total: dto.total, hasNext: dto.has_next };
    }),

  getSchedule: (doctorId) => attempt(async () => toSchedule(await api.getSchedule(doctorId))),
  getScheduleHistory: (doctorId) =>
    attempt(async () => {
      const [leaves, exceptions] = await Promise.all([
        api.getLeaves(doctorId),
        api.getDateExceptions(doctorId),
      ]);
      return { leaves: leaves.map(toLeave), dateExceptions: exceptions.map(toDateException) };
    }),
  replaceWeeklySessions: (doctorId, sessions, version, mode) =>
    attempt(async () => toChange(await api.putWeeklySessions(doctorId, sessions, version, mode))),

  createLeave: (doctorId, input, mode) =>
    attempt(async () => toChange(await api.postLeave(doctorId, input, mode))),
  updateLeave: (doctorId, leave, input, mode) =>
    attempt(async () =>
      toChange(await api.patchLeave(doctorId, leave.id, input, leave.version, mode)),
    ),
  deleteLeave: (doctorId, leave, mode) =>
    attempt(async () => toChange(await api.deleteLeave(doctorId, leave, mode))),

  createDateException: (doctorId, input, mode) =>
    attempt(async () => toChange(await api.postDateException(doctorId, input, mode))),
  updateDateException: (doctorId, exception, input, mode) =>
    attempt(async () =>
      toChange(
        await api.patchDateException(doctorId, exception.id, input, exception.version, mode),
      ),
    ),
  deleteDateException: (doctorId, exception, mode) =>
    attempt(async () => toChange(await api.deleteDateException(doctorId, exception, mode))),
};
