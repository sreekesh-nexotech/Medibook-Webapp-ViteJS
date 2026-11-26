import { cn } from '@/shared/lib/cn';
import {
  PATIENT_FLAG_HINT,
  PATIENT_FLAG_LABEL,
  type PatientAccountFlag,
} from '@/shared/lib/patientAccountFlag';

interface PatientFlagBadgeProps {
  flag: PatientAccountFlag | null;
  className?: string;
}

/**
 * Tells the desk a patient's account is blocked or awaiting deletion. Information
 * only — it never gates check-in, calling or payment (UAT part 2, T10/T12/T16).
 */
export function PatientFlagBadge({ flag, className }: PatientFlagBadgeProps) {
  if (flag === null) return null;
  return (
    <span
      title={PATIENT_FLAG_HINT[flag]}
      data-testid="patient-flag-badge"
      data-flag={flag}
      className={cn(
        'text-badge inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold whitespace-nowrap',
        flag === 'blocked'
          ? 'bg-badge-cancelled-bg text-badge-cancelled-fg'
          : 'bg-y-100 text-y-700',
        className,
      )}
    >
      {PATIENT_FLAG_LABEL[flag]}
    </span>
  );
}
