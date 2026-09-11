import type { ChangeEvent } from 'react';

import { DEPT_COLORS, mkWeek } from '@/features/doctors/application/store/catalog.fixtures';
import { useCatalogStore } from '@/features/doctors/application/store/catalog.store';
import type { Dept, DeptStatus, WeekDay } from '@/features/doctors/application/store/catalog.types';
import { summariseWeekHours } from '@/features/doctors/domain/schedule';
import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { positiveAmount, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { ImageUpload } from '@/shared/ui/ImageUpload';
import { InfoDot } from '@/shared/ui/InfoDot';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { WeeklyHours } from './WeeklyHours';

/** Editable draft — `fee` is digits-only text until parsed on save (design `d`). */
interface DeptForm {
  name: string;
  about: string;
  fee: string;
  status: DeptStatus;
  color: string;
  week: readonly WeekDay[];
  image: string | null;
}

/**
 * Validators are declared at module level so `useForm`'s error memo stays
 * stable (shared contract §5).
 */
const DEPT_VALIDATORS: FormValidators<DeptForm> = {
  name: (v) => required(v, 'Department name'),
  fee: (v) => positiveAmount(v, 'Base consultation fee'),
};

/** Blank department with the next color cycled off the current catalog length. */
function blankDept(count: number): DeptForm {
  return {
    name: '',
    about: '',
    fee: '',
    status: 'Active',
    color: DEPT_COLORS[count % DEPT_COLORS.length],
    week: mkWeek([0, 1, 2, 3, 4, 5], '9:00 am', '6:00 pm'),
    image: null,
  };
}

function toForm(dept: Dept): DeptForm {
  return {
    name: dept.name,
    about: dept.about,
    fee: String(dept.fee || ''),
    status: dept.status,
    color: dept.color,
    week: dept.week,
    image: dept.image ?? null,
  };
}

function readImage(e: ChangeEvent<HTMLInputElement>, cb: (dataUrl: string) => void): void {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') cb(reader.result);
  };
  reader.readAsDataURL(file);
}

/** Keep only digits, so the ₹ prefix the input shows never reaches the value. */
function digits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

interface DeptModalProps {
  dept: Dept | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Add / edit department modal (design `DeptModal`), on `FormModal` so Enter
 * submits (audit 3.5.6) and on `useForm` so a bad name or fee is reported
 * **under the field that is wrong** instead of a toast that vanishes
 * (audit 3.5.1).
 *
 * The old prop-sync `useEffect` is gone: the caller mounts this with a `key`
 * per department, so the draft is initialised once per edit session.
 */
export function DeptModal({ dept, open, onClose }: DeptModalProps) {
  const isNew = !dept || !dept.id;
  const deptCount = useCatalogStore((s) => s.depts.length);
  const catSaveDept = useCatalogStore((s) => s.catSaveDept);

  const form = useForm<DeptForm>({
    initial: dept ? toForm(dept) : blankDept(deptCount),
    validate: DEPT_VALIDATORS,
    onSubmit: (values) => {
      catSaveDept({
        id: dept?.id,
        name: values.name.trim(),
        about: values.about.trim(),
        fee: Number(digits(values.fee)) || 0,
        status: values.status,
        color: values.color,
        week: values.week,
        image: values.image,
        // Derived, never typed: the caption on the card can then never
        // disagree with the grid underneath it.
        hours: summariseWeekHours(values.week),
      });
      toast(isNew ? 'Department added' : 'Department updated', 'success');
      onClose();
    },
  });

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isNew ? 'Add Department' : 'Edit Department'}
      width={680}
      onSubmit={form.handleSubmit}
      submitLabel={isNew ? 'Add Department' : 'Save'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4.5">
          <Field label="Department Name" required error={form.errorFor('name')}>
            <TextInput
              value={form.values.name}
              placeholder="e.g. Cardiology"
              onChange={(v) => form.setField('name', v)}
              onBlur={() => form.blurField('name')}
            />
          </Field>
          <Field
            label="Base Consultation Fee"
            required
            error={form.errorFor('fee')}
            hint="Used when a doctor in this department has no fee of their own."
          >
            <TextInput
              value={form.values.fee ? `₹ ${form.values.fee}` : ''}
              placeholder="₹ 0"
              inputMode="numeric"
              onChange={(v) => form.setField('fee', digits(v))}
              onBlur={() => form.blurField('fee')}
            />
          </Field>
          <Field label="About" className="col-span-full">
            {(field) => (
              <textarea
                id={field.id}
                value={form.values.about}
                placeholder="Short description shown in the patient app"
                onChange={(e) => form.setField('about', e.target.value)}
                className="border-border text-body-lg text-text-strong rounded-input box-border h-18.5 w-full resize-none border p-3"
              />
            )}
          </Field>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-body text-text-strong font-medium">Department Image</span>
            <InfoDot text="Shown on the department's page in the Medibook patient app." />
          </div>
          <label className="block cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => readImage(e, (url) => form.setField('image', url))}
            />
            {form.values.image ? (
              <img
                src={form.values.image}
                alt="Department"
                className="border-border h-27.5 w-full rounded-lg border object-cover"
              />
            ) : (
              <ImageUpload label="Upload image" hint="Optional · 800×450" h={110} />
            )}
          </label>
        </div>
        <WeeklyHours
          value={form.values.week}
          onChange={(week) => form.setField('week', week)}
          info="Department hours override hospital hours. Doctors can narrow this further."
        />
        <Field label="Status">
          <Select
            value={form.values.status}
            options={['Active', 'Inactive']}
            onChange={(v) => form.setField('status', v as DeptStatus)}
          />
        </Field>
      </div>
    </FormModal>
  );
}
