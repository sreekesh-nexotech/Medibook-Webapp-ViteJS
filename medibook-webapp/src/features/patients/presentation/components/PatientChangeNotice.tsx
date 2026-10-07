import { fmtDate } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';

import type {
  PatientChangeDecision,
  PendingPatientChange,
} from '@/features/patients/domain/entities/patients.entities';
import { PatientChangeValues } from '@/features/patients/presentation/components/PatientChangeValues';
import { PatientDecisionActions } from '@/features/patients/presentation/components/PatientDecisionActions';
import { changedFieldsText } from '@/features/patients/presentation/components/patientsFormat';

interface PatientChangeNoticeProps {
  change: PendingPatientChange;
  /** After an admin decides it here (e.g. leave a record whose deletion was approved). */
  onDecided?: (decision: PatientChangeDecision) => void;
}

/**
 * D-29: an edit or delete on this record is waiting for an admin. Everyone
 * sees the notice with each field's current and proposed value; a user who
 * may decide gets Approve / Reject.
 */
export function PatientChangeNotice({ change, onDecided }: PatientChangeNoticeProps) {
  const what =
    change.kind === 'delete'
      ? 'Deleting this record'
      : `A change to ${changedFieldsText(change.changedFields) || 'this record'}`;

  return (
    <Card pad={18} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Icon name="info" size={18} className="text-blue flex-none" />
        <div className="min-w-60 flex-1">
          <div className="text-body text-text-strong font-medium">
            {what} is waiting for admin approval.
          </div>
          <div className="text-caption text-text-muted mt-1">
            Requested {fmtDate(change.requestedAt.slice(0, 10))}
            {change.requestedByName ? ` by ${change.requestedByName}` : ''}. The record shows the
            current details until it is approved.
          </div>
        </div>
        <PatientDecisionActions
          requestId={change.id}
          kind={change.kind}
          requestedByUserId={change.requestedByUserId}
          requestedByName={change.requestedByName}
          onDecided={onDecided}
        />
      </div>
      {change.changes.length > 0 && <PatientChangeValues changes={change.changes} />}
    </Card>
  );
}
