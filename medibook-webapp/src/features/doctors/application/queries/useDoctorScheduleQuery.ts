import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { fetchDoctorSchedule } from '@/features/doctors/application/usecases/fetchDoctorSchedule';

/** Weekly sessions, leave and date exceptions of one doctor. `null` stays idle. */
export function useDoctorScheduleQuery(doctorId: string | null) {
  return useQuery({
    queryKey: doctorsKeys.schedule(doctorId ?? ''),
    queryFn: async () => unwrap(await fetchDoctorSchedule(doctorId ?? '')),
    enabled: doctorId !== null,
  });
}
