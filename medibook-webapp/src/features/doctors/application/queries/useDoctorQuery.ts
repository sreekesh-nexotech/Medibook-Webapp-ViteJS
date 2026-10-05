import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { fetchDoctor } from '@/features/doctors/application/usecases/fetchDoctor';

/** One doctor's profile. `null` id (the "new doctor" page) stays idle. */
export function useDoctorQuery(id: string | null) {
  return useQuery({
    queryKey: doctorsKeys.detail(id ?? ''),
    queryFn: async () => unwrap(await fetchDoctor(id ?? '')),
    enabled: id !== null,
  });
}
