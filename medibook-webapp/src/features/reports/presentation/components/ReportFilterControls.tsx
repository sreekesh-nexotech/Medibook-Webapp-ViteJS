import { isFailure } from '@/core/error/failure';

import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import type {
  ReportFilterDef,
  ReportParams,
} from '@/features/reports/domain/entities/reports.entities';

import { ReportFilterBar } from './ReportFilterBar';

/** The `uuid` filters that need the hospital's catalogue for their options (`specs.py` keys). */
const PICKER_FILTERS: ReadonlySet<string> = new Set(['department', 'doctor']);

const HTTP_FORBIDDEN = 403;

interface ReportFilterControlsProps {
  filters: readonly ReportFilterDef[];
  params: ReportParams;
  onChange: (patch: ReportParams) => void;
}

/**
 * The report's filters. The doctor and department lists are read only for a
 * report that filters by them (08 F12); with the backend's any-of read rule a
 * Reports viewer may read them (B2), and a refusal is explained rather than
 * swallowed into an empty "All doctors".
 */
export function ReportFilterControls({ filters, params, onChange }: ReportFilterControlsProps) {
  const needsPickers = filters.some((f) => f.kind === 'uuid' && PICKER_FILTERS.has(f.key));
  if (!needsPickers) {
    return (
      <ReportFilterBar
        filters={filters}
        params={params}
        onChange={onChange}
        departments={[]}
        doctors={[]}
      />
    );
  }
  return <ReportFilterBarWithPickers filters={filters} params={params} onChange={onChange} />;
}

function ReportFilterBarWithPickers({ filters, params, onChange }: ReportFilterControlsProps) {
  const departments = useDepartmentsQuery();
  const doctors = useDoctorsQuery();
  const refused = [departments.error, doctors.error].some(
    (e) => isFailure(e) && e.status === HTTP_FORBIDDEN,
  );
  const failed = !refused && (departments.isError || doctors.isError);
  return (
    <>
      <ReportFilterBar
        filters={filters}
        params={params}
        onChange={onChange}
        departments={departments.data ?? []}
        doctors={doctors.data ?? []}
      />
      {(refused || failed) && (
        <span className="text-caption text-text-muted">
          {refused
            ? 'Your role cannot list doctors and departments, so those filters are empty.'
            : 'Doctors and departments did not load; refresh to filter by them.'}
        </span>
      )}
    </>
  );
}
