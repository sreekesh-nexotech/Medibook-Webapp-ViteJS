import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { fetchDoctorScheduleHistory } from '@/features/doctors/application/usecases/fetchDoctorScheduleHistory';

/** A doctor's past and future leave and date exceptions; idle without an id. */
export function useDoctorScheduleHistoryQuery(doctorId: string | null) {
  return useQuery({
    queryKey: doctorsKeys.scheduleHistory(doctorId ?? ''),
    queryFn: async () => unwrap(await fetchDoctorScheduleHistory(doctorId ?? '')),
    enabled: doctorId !== null,
  });
}
