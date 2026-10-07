import type { PatientFieldChange } from '@/features/patients/domain/entities/patients.entities';
import {
  changeValueText,
  fieldLabel,
} from '@/features/patients/presentation/components/patientsFormat';

interface PatientChangeValuesProps {
  changes: readonly PatientFieldChange[];
}

/** Each changed field with its current and proposed value, so an approver sees what they approve. */
export function PatientChangeValues({ changes }: PatientChangeValuesProps) {
  return (
    <dl className="m-0 flex flex-col gap-1.5">
      {changes.map((c) => (
        <div key={c.field} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5">
          <dt className="text-caption text-text-muted w-36 flex-none capitalize">
            {fieldLabel(c.field)}
          </dt>
          <dd className="text-body m-0 min-w-0 flex-1 break-words">
            <span className="text-text-muted line-through">
              {changeValueText(c.field, c.before)}
            </span>
            <span className="text-text-muted px-1.5" aria-hidden="true">
              →
            </span>
            <span className="sr-only">changes to</span>
            <span className="text-text-strong font-medium">
              {changeValueText(c.field, c.after)}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
