import { useNavigate, useParams } from 'react-router-dom';

import { opsPath } from '@/app/router/paths';
import { isFailure } from '@/core/error/failure';
import { Button } from '@/shared/ui/Button';
import { ErrorState } from '@/shared/ui/ErrorState';
import { OpsSkeleton } from '@/shared/ui/OpsSkeleton';

import { useHospitalQuery } from '@/features/ops-hospitals/application/queries/useHospitalQuery';

import { HospitalProfile } from '@/features/ops-hospitals/presentation/components/HospitalProfile';

/**
 * Ops hospital detail route (`/ops/hospitals/:id`, a backend UUID): loads
 * `GET /platform/hospitals/{id}` and renders the profile, with loading,
 * not-found and error states.
 */
export function OpsHospitalDetailScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const hospital = useHospitalQuery(id);

  if (hospital.isPending) return <OpsSkeleton />;

  if (hospital.isError) {
    const isNotFound = isFailure(hospital.error) && hospital.error.kind === 'notFound';
    return (
      <ErrorState
        icon={isNotFound ? 'building-2' : undefined}
        title={isNotFound ? 'Hospital not found' : "This hospital didn't load"}
        message={
          isNotFound
            ? 'It may have been removed, or the link is out of date.'
            : isFailure(hospital.error)
              ? hospital.error.message
              : undefined
        }
        onRetry={isNotFound ? undefined : () => void hospital.refetch()}
      >
        <Button
          variant="secondary"
          icon="arrow-left"
          onClick={() => navigate(opsPath('hospitals'))}
        >
          Back to Hospitals
        </Button>
      </ErrorState>
    );
  }

  return <HospitalProfile h={hospital.data} />;
}
