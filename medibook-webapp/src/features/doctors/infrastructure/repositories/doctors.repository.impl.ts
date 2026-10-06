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
  toDateException,
  toLeave,
  toSchedule,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';

/** The envelope without its `result` (the endpoints whose result the app does not use). */
function toChange(dto: ScheduleChangeResponse): ScheduleChange {
  return { dryRun: dto.dry_run, affectedBookings: toAffectedBookings(dto), result: null };
}

/** The doctor PATCH envelope — `result` is the updated doctor once applied. */
function toDoctorChange(dto: ScheduleChangeResponse): ScheduleChange<DoctorProfile> {
  return {
    dryRun: dto.dry_run,
    affectedBookings: toAffectedBookings(dto),
    result: dto.result == null ? null : toDoctor(doctorResponseSchema.parse(dto.result)),
  };
}

export const doctorsRepository: DoctorsRepository = {
  listDepartments: () => attempt(async () => (await api.getDepartments()).map(toDepartment)),
  createDepartment: (input) => attempt(async () => toDepartment(await api.postDepartment(input))),
  updateDepartment: (id, input) =>
    attempt(async () => toDepartment(await api.patchDepartment(id, input))),
  deleteDepartment: (id) =>
    attempt(async () => {
      await api.deleteDepartment(id);
      return null;
    }),

  listDoctors: (filters) => attempt(async () => (await api.getDoctors(filters)).map(toDoctor)),
  getDoctor: (id) => attempt(async () => toDoctor(await api.getDoctor(id))),
  createDoctor: (input) => attempt(async () => toDoctor(await api.postDoctor(input))),
  updateDoctor: (id, input, version, confirm) =>
    attempt(async () => toDoctorChange(await api.patchDoctor(id, input, version, confirm))),
  deleteDoctor: (id, confirm) => attempt(async () => toChange(await api.deleteDoctor(id, confirm))),

  getPhotoUrl: async (fileId) => {
    const signed = await getFileUrl(fileId);
    return signed.ok ? ok(signed.data.url) : signed;
  },

  getSchedule: (doctorId) => attempt(async () => toSchedule(await api.getSchedule(doctorId))),
  getScheduleHistory: (doctorId) =>
    attempt(async () => {
      const [leaves, exceptions] = await Promise.all([
        api.getLeaves(doctorId),
        api.getDateExceptions(doctorId),
      ]);
      return { leaves: leaves.map(toLeave), dateExceptions: exceptions.map(toDateException) };
    }),
  replaceWeeklySessions: (doctorId, sessions, version, confirm) =>
    attempt(async () =>
      toChange(await api.putWeeklySessions(doctorId, sessions, version, confirm)),
    ),

  createLeave: (doctorId, input, confirm) =>
    attempt(async () => toChange(await api.postLeave(doctorId, input, confirm))),
  updateLeave: (doctorId, leaveId, input, version, confirm) =>
    attempt(async () => toChange(await api.patchLeave(doctorId, leaveId, input, version, confirm))),
  deleteLeave: (doctorId, leaveId, confirm) =>
    attempt(async () => toChange(await api.deleteLeave(doctorId, leaveId, confirm))),

  createDateException: (doctorId, input, confirm) =>
    attempt(async () => toChange(await api.postDateException(doctorId, input, confirm))),
  updateDateException: (doctorId, exceptionId, input, version, confirm) =>
    attempt(async () =>
      toChange(await api.patchDateException(doctorId, exceptionId, input, version, confirm)),
    ),
  deleteDateException: (doctorId, exceptionId, confirm) =>
    attempt(async () => toChange(await api.deleteDateException(doctorId, exceptionId, confirm))),
};
