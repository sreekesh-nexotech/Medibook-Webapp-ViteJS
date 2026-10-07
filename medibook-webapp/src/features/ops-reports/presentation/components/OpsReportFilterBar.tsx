import type { ReactNode } from 'react';

import { useOpsPermission } from '@/shared/hooks/useOpsPermission';
import { FilterSelect } from '@/shared/ui/FilterSelect';
import { TextInput } from '@/shared/ui/TextInput';

import { useHospitalOptionsQuery } from '@/features/ops-hospitals/application/queries/useHospitalOptionsQuery';
import { usePlansQuery } from '@/features/ops-plans/application/queries/usePlansQuery';
import type {
  OpsReportFilter,
  OpsReportParams,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import { valueLabel } from '@/features/ops-reports/presentation/components/opsReportsFormat';

const DATE_INPUT_CLASS =
  'rounded-input border-border text-body text-text-body h-11 border bg-white px-3';

/** Filter keys the console can offer a picker for (backend `specs.py`). */
const HOSPITAL_FILTER = 'hospital';
const PLAN_FILTER = 'plan';

interface OpsReportFilterBarProps {
  filters: readonly OpsReportFilter[];
  params: OpsReportParams;
  onChange: (patch: OpsReportParams) => void;
  /** Per-param messages from the last check or run. */
  errors: Readonly<Record<string, string>>;
}

interface PickerProps {
  filter: OpsReportFilter;
  param: string;
  value: string;
  onChange: (patch: OpsReportParams) => void;
}

/** "Any status" — the empty entry of a choice filter. */
function anyLabel(label: string): string {
  return `Any ${label.toLowerCase()}`;
}

/** A pasted id, for the `uuid` filters the console has no directory for (doctor, user…). */
function IdInput({ filter, param, value, onChange }: PickerProps) {
  return (
    <div className="w-80">
      <TextInput
        value={value}
        onChange={(v) => onChange({ [param]: v })}
        placeholder={`${filter.label} id (UUID)`}
        aria-label={`Filter by ${filter.label.toLowerCase()} id`}
        height={44}
      />
    </div>
  );
}

/** The hospital registry as a picker (needs `hospitals.view`, else the id box). */
function HospitalPicker({ filter, param, value, onChange }: PickerProps) {
  const hospitals = useHospitalOptionsQuery();
  if (!hospitals.canView) {
    return <IdInput filter={filter} param={param} value={value} onChange={onChange} />;
  }
  const all = `All hospitals`;
  return (
    <FilterSelect
      value={hospitals.options.find((h) => h.id === value)?.name ?? all}
      options={[all, ...hospitals.options.map((h) => h.name)]}
      onChange={(name) =>
        onChange({ [param]: hospitals.options.find((h) => h.name === name)?.id ?? '' })
      }
      aria-label="Filter by hospital"
    />
  );
}

/** The plan catalogue as a picker — only rendered for roles with `plans.view`. */
function PlanPicker({ param, value, onChange }: PickerProps) {
  const plans = usePlansQuery();
  const list = plans.data ?? [];
  const all = 'All plans';
  return (
    <FilterSelect
      value={list.find((p) => p.id === value)?.name ?? all}
      options={[all, ...list.map((p) => p.name)]}
      onChange={(name) => onChange({ [param]: list.find((p) => p.name === name)?.id ?? '' })}
      aria-label="Filter by plan"
    />
  );
}

/**
 * Exactly the filters the report's definition lists, in the binding sheet's
 * order and wording (UAT-36, 12·R4): date ranges as from/to, choices as a
 * select, hospitals and plans as pickers, and any other id as a pasted UUID.
 */
export function OpsReportFilterBar({ filters, params, onChange, errors }: OpsReportFilterBarProps) {
  const canViewPlans = useOpsPermission().can('plans.view');

  const controls = filters.map((f): ReactNode => {
    if (f.kind === 'date_range') {
      const [fromParam, toParam] = f.params;
      if (!fromParam || !toParam) return null;
      return (
        <div key={f.key} className="flex flex-wrap items-center gap-2">
          <span className="text-body text-text-muted">{f.label}</span>
          <input
            type="date"
            value={params[fromParam] ?? ''}
            max={params[toParam] || undefined}
            onChange={(e) => onChange({ [fromParam]: e.target.value })}
            aria-label={`${f.label} from`}
            title={`${f.label} from (IST)`}
            className={DATE_INPUT_CLASS}
          />
          <span className="text-body text-text-muted">to</span>
          <input
            type="date"
            value={params[toParam] ?? ''}
            min={params[fromParam] || undefined}
            onChange={(e) => onChange({ [toParam]: e.target.value })}
            aria-label={`${f.label} to`}
            title={`${f.label} to (IST)`}
            className={DATE_INPUT_CLASS}
          />
        </div>
      );
    }

    const param = f.params[0];
    if (!param) return null;
    const value = params[param] ?? '';
    const picker: PickerProps = { filter: f, param, value, onChange };

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
    if (f.kind === 'uuid' && f.key === HOSPITAL_FILTER)
      return <HospitalPicker key={f.key} {...picker} />;
    if (f.kind === 'uuid' && f.key === PLAN_FILTER && canViewPlans) {
      return <PlanPicker key={f.key} {...picker} />;
    }
    return <IdInput key={f.key} {...picker} />;
  });

  const messages = Object.values(errors);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">{controls}</div>
      {messages.length > 0 && (
        <div role="alert" className="text-caption text-d-700 flex flex-col gap-0.5">
          {messages.map((m) => (
            <span key={m}>{m}</span>
          ))}
        </div>
      )}
    </div>
  );
}
