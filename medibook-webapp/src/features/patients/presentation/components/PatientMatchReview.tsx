import { fmtDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';

import type { PatientMatchCandidate } from '@/features/patients/domain/entities/patients.entities';
import { genderLabel } from '@/features/patients/presentation/components/patientsFormat';

interface PatientMatchReviewProps {
  candidates: readonly PatientMatchCandidate[];
  /** Open an existing record instead of registering a new one. */
  onUse: (candidate: PatientMatchCandidate) => void;
}

/**
 * The desk's decision on possible duplicates (backend B6, M-14, decision 6):
 * records here share the phone and first name, but a date of birth is
 * missing, so the server cannot tell whether this is the same person. The
 * desk opens one of them, or submits again to register a new record.
 */
export function PatientMatchReview({ candidates, onUse }: PatientMatchReviewProps) {
  return (
    <div className="bg-y-100 mb-4 rounded-md border border-y-300 px-3.5 py-3" role="alert">
      <div className="text-body text-text-strong mb-1 flex items-center gap-2 font-semibold">
        <Icon name="triangle-alert" size={16} className="text-y-700 flex-none" />
        This may be someone already registered here
      </div>
      <p className="text-caption text-text-body m-0 mb-2.5">
        {candidates.length === 1 ? 'A record shares' : `${candidates.length} records share`} this
        phone number and first name, but a date of birth is missing, so Medibook cannot confirm it
        is the same person. Open the right record, or select “Register as New Patient” if this is
        someone else.
      </p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {candidates.map((c) => {
          const facts = [
            c.dateOfBirth ? `Born ${fmtDate(c.dateOfBirth)}` : 'No date of birth',
            genderLabel(c.gender),
            c.createdAt ? `registered ${fmtDate(c.createdAt.slice(0, 'yyyy-mm-dd'.length))}` : '',
          ].filter(Boolean);
          return (
            <li
              key={c.id}
              className="border-border-soft flex flex-wrap items-center gap-3 rounded-md border bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-body text-text-strong font-medium">
                  {c.fullName} <span className="text-text-muted font-normal">· {c.mrn}</span>
                </div>
                <div className="text-caption text-text-muted">{facts.join(' · ')}</div>
              </div>
              <Button size="sm" variant="secondary" icon="user" onClick={() => onUse(c)}>
                Open this record
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
