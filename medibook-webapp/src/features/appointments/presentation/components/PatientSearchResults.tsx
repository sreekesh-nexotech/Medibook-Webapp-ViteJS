import { Avatar } from '@/shared/ui/Avatar';

import { isFailure } from '@/core/error/failure';

import { usePatientsQuery } from '@/features/patients/application/queries/usePatientsQuery';
import type { PatientRecord } from '@/features/patients/domain/entities/patients.entities';

/** Rows in the dropdown. */
const SEARCH_RESULTS = 6;

/** Desk phones are Indian mobiles; show them without the country code. */
const INDIA_PREFIX = '+91';

function displayPhone(e164: string | null): string | null {
  if (!e164) return null;
  return e164.startsWith(INDIA_PREFIX) ? e164.slice(INDIA_PREFIX.length) : e164;
}

interface PatientSearchResultsProps {
  /** Already trimmed and long enough to search. */
  readonly query: string;
  readonly onPick: (patient: PatientRecord) => void;
}

/**
 * The patient-search dropdown under the New Appointment search box. While a
 * new query is in flight the previous query's rows are kept as placeholder
 * data, so the dropdown says "Searching…" instead of showing rows that no
 * longer match what was typed.
 */
export function PatientSearchResults({ query, onPick }: PatientSearchResultsProps) {
  const search = usePatientsQuery({
    page: 1,
    pageSize: SEARCH_RESULTS,
    q: query,
    source: null,
    sortField: 'full_name',
    sortDirection: 'asc',
  });
  const matches = search.data?.items ?? [];

  return (
    <div className="border-border shadow-pop absolute top-14.5 right-0 left-0 z-20 overflow-hidden rounded-md border bg-white">
      {search.isPending || search.isPlaceholderData ? (
        <div className="text-caption text-text-muted px-3.5 py-3">Searching…</div>
      ) : search.isError ? (
        <div className="text-caption text-danger px-3.5 py-3">
          {isFailure(search.error) ? search.error.message : 'Search failed.'}
        </div>
      ) : matches.length === 0 ? (
        <div className="text-caption text-text-muted px-3.5 py-3">
          No patient matches — add them as a new patient.
        </div>
      ) : (
        matches.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className="hover:bg-grey-200 flex w-full cursor-pointer items-center gap-3 px-3.5 py-2.75 text-left"
          >
            <Avatar name={p.fullName} size={30} />
            <div className="flex-1">
              <div className="text-body text-text-strong font-medium">{p.fullName}</div>
              <div className="text-caption text-text-muted">
                {[p.mrn, displayPhone(p.phone)].filter(Boolean).join(' · ')}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
