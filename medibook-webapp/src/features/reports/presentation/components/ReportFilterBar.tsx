import type { ReactNode } from 'react';

import { FilterSelect } from '@/shared/ui/FilterSelect';

import type {
  ReportFilterDef,
  ReportParams,
} from '@/features/reports/domain/entities/reports.entities';

import { valueLabel } from './reportsFormat';

const DATE_INPUT_CLASS =
  'rounded-input border-border-control text-body text-text-body h-11 border bg-white px-3';

const ALL_DEPARTMENTS = 'All departments';
const ALL_DOCTORS = 'All doctors';

/** The `uuid` filters this screen can offer options for (backend `specs.py` keys). */
const DEPARTMENT_FILTER = 'department';
const DOCTOR_FILTER = 'doctor';

export interface ReportFilterOption {
  readonly id: string;
  readonly name: string;
}

export interface ReportDoctorOption extends ReportFilterOption {
  readonly departmentId: string;
}

interface ReportFilterBarProps {
  filters: readonly ReportFilterDef[];
  params: ReportParams;
  /** Set several params at once (a department change also clears the doctor). */
  onChange: (patch: ReportParams) => void;
  departments: readonly ReportFilterOption[];
  doctors: readonly ReportDoctorOption[];
}

/** The "any" entry of a choice filter, e.g. "Any payment status". */
function anyLabel(label: string): string {
  return `Any ${label.toLowerCase()}`;
}

/**
 * Exactly the filter controls the server's report definition lists — so a
 * report never shows a control that does nothing, and never filters by
 * something the user cannot see. A filter kind this screen has no options for
 * is not drawn.
 */
export function ReportFilterBar({
  filters,
  params,
  onChange,
  departments,
  doctors,
}: ReportFilterBarProps) {
  const departmentParam = filters.find((f) => f.key === DEPARTMENT_FILTER)?.params[0];
  const selectedDepartment = departmentParam ? (params[departmentParam] ?? '') : '';

  const controls = filters.map((f): ReactNode => {
    if (f.kind === 'date_range') {
      const [fromParam, toParam] = f.params;
      if (!fromParam || !toParam) return null;
      return (
        <div key={f.key} className="flex flex-wrap items-center gap-3">
          <span className="text-body text-text-muted">{f.label}</span>
          <input
            type="date"
            value={params[fromParam] ?? ''}
            max={params[toParam] || undefined}
            onChange={(e) => onChange({ [fromParam]: e.target.value })}
            aria-label={`${f.label} from`}
            title={`${f.label} from`}
            className={DATE_INPUT_CLASS}
          />
          <span className="text-body text-text-muted">to</span>
          <input
            type="date"
            value={params[toParam] ?? ''}
            min={params[fromParam] || undefined}
            onChange={(e) => onChange({ [toParam]: e.target.value })}
            aria-label={`${f.label} to`}
            title={`${f.label} to`}
            className={DATE_INPUT_CLASS}
          />
        </div>
      );
    }

    const param = f.params[0];
    if (!param) return null;
    const value = params[param] ?? '';

    if (f.kind === 'choice') {
      const any = anyLabel(f.label);
      return (
        <FilterSelect
          key={f.key}
          value={value ? valueLabel(value) : any}
          options={[any, ...f.choices.map(valueLabel)]}
          onChange={(label) =>
            onChange({ [param]: f.choices.find((c) => valueLabel(c) === label) ?? '' })
          }
          aria-label={`Filter by ${f.label.toLowerCase()}`}
        />
      );
    }

    if (f.kind === 'uuid' && f.key === DEPARTMENT_FILTER) {
      const doctorParam = filters.find((d) => d.key === DOCTOR_FILTER)?.params[0];
      return (
        <FilterSelect
          key={f.key}
          value={departments.find((d) => d.id === value)?.name ?? ALL_DEPARTMENTS}
          options={[ALL_DEPARTMENTS, ...departments.map((d) => d.name)]}
          onChange={(name) => {
            const id = departments.find((d) => d.name === name)?.id ?? '';
            // A doctor outside the new department would make the report empty.
            const doctorId = doctorParam ? (params[doctorParam] ?? '') : '';
            const keepsDoctor = doctors.some((d) => d.id === doctorId && d.departmentId === id);
            onChange(
              doctorParam && !keepsDoctor ? { [param]: id, [doctorParam]: '' } : { [param]: id },
            );
          }}
          aria-label="Filter by department"
        />
      );
    }

    if (f.kind === 'uuid' && f.key === DOCTOR_FILTER) {
      const shown = selectedDepartment
        ? doctors.filter((d) => d.departmentId === selectedDepartment)
        : doctors;
      return (
        <FilterSelect
          key={f.key}
          value={doctors.find((d) => d.id === value)?.name ?? ALL_DOCTORS}
          options={[ALL_DOCTORS, ...shown.map((d) => d.name)]}
          onChange={(name) => onChange({ [param]: shown.find((d) => d.name === name)?.id ?? '' })}
          aria-label="Filter by doctor"
        />
      );
    }

    return null;
  });

  return <>{controls}</>;
}
