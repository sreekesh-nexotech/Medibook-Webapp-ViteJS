import { useState } from 'react';

import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Button } from '@/shared/ui/Button';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { ToggleChip } from '@/shared/ui/ToggleChip';
import { toast } from '@/shared/ui/toast/toast.store';

import type {
  DisplayDevice,
  DisplayDeviceWithKey,
  DisplaySelection,
} from '@/features/settings/domain/entities/settings.entities';
import {
  doctorsForDepartment,
  selectionChanges,
  selectionOf,
  toggleDoctor,
  withDepartment,
} from '@/features/settings/domain/displaySelection';
import { useDepartmentsQuery } from '@/features/doctors/application/queries/useDepartmentsQuery';
import { useDoctorsQuery } from '@/features/doctors/application/queries/useDoctorsQuery';
import {
  useRegisterDisplayDeviceMutation,
  useUpdateDisplayDeviceMutation,
} from '@/features/settings/application/queries/useDisplayDeviceMutations';

import { DisplayPreviewModal } from './DisplayPreviewModal';

const NAME_MAX = 120;
const ALL_DEPARTMENTS = 'All departments';

interface DeviceForm {
  name: string;
}

const VALIDATORS: FormValidators<DeviceForm> = {
  name: (v) => required(v, 'Screen name'),
};

const SERVER_FIELDS = { name: 'name' } as const;

interface DisplayDeviceModalProps {
  /** `null` registers a new screen. */
  device: DisplayDevice | null;
  onClose: () => void;
  /** Called with the new screen and its one-time key after registering. */
  onRegistered: (created: DisplayDeviceWithKey) => void;
}

/**
 * Register a token display screen or edit one: its name, the ONE department it shows (or all)
 * and, optionally, some doctors of that department (client feedback point 8), with a Preview of
 * what the screen will show before it is saved.
 */
export function DisplayDeviceModal({ device, onClose, onRegistered }: DisplayDeviceModalProps) {
  const register = useRegisterDisplayDeviceMutation();
  const update = useUpdateDisplayDeviceMutation();
  const departments = useDepartmentsQuery();
  const doctors = useDoctorsQuery();
  const [selection, setSelection] = useState<DisplaySelection>(
    device ? selectionOf(device) : { departmentId: null, doctorIds: [] },
  );
  const [previewing, setPreviewing] = useState(false);

  const form = useForm<DeviceForm>({
    initial: { name: device?.name ?? '' },
    validate: VALIDATORS,
    onSubmit: async ({ name }) => {
      try {
        if (device) {
          const changes = {
            ...(name.trim() !== device.name && { name: name.trim() }),
            ...selectionChanges(device, selection),
          };
          if (Object.keys(changes).length > 0) {
            await update.mutateAsync({ id: device.id, changes, version: device.version });
            toast('Screen saved', 'success');
          }
          onClose();
          return;
        }
        onRegistered(await register.mutateAsync({ name: name.trim(), selection }));
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: SERVER_FIELDS },
            'The screen could not be saved.',
          ),
          'error',
        );
      }
    },
  });

  const departmentList = (departments.data ?? []).filter(
    (d) => d.isActive || d.id === selection.departmentId,
  );
  const departmentName =
    departmentList.find((d) => d.id === selection.departmentId)?.name ?? ALL_DEPARTMENTS;
  const doctorList = doctorsForDepartment(doctors.data ?? [], selection.departmentId).filter(
    (d) => d.status !== 'inactive' || selection.doctorIds.includes(d.id),
  );
  const catalogueLoading = departments.isPending || doctors.isPending;
  const catalogueFailed = departments.isError || doctors.isError;
  const selectionDirty = device
    ? Object.keys(selectionChanges(device, selection)).length > 0
    : selection.departmentId !== null || selection.doctorIds.length > 0;

  return (
    <>
      <FormModal
        open
        onClose={onClose}
        title={device ? 'Edit Screen' : 'Register a Display Screen'}
        width={560}
        onSubmit={form.handleSubmit}
        submitLabel={device ? 'Save' : 'Register'}
        busy={form.submitting}
        dirty={form.isDirty || selectionDirty}
        footerLeft={
          <Button
            variant="secondary"
            icon="eye"
            onClick={() => setPreviewing(true)}
            disabled={catalogueLoading}
          >
            Preview
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FormErrorSummary messages={form.serverSummary} />
          <Field
            label="Screen name"
            required
            error={form.errorFor('name')}
            hint="Where it hangs, e.g. “Cardiology waiting area”."
          >
            <TextInput
              value={form.values.name}
              onChange={(v) => form.setField('name', v)}
              onBlur={() => form.blurField('name')}
              maxLength={NAME_MAX}
              autoFocus
            />
          </Field>
          {catalogueFailed ? (
            <p role="alert" className="text-caption text-danger">
              Departments and doctors did not load, so the screen&apos;s department cannot be
              changed right now.
            </p>
          ) : (
            <>
              <Field
                label="Department"
                hint={
                  selection.departmentId === null
                    ? 'The screen shows every department’s queues.'
                    : 'The screen shows only this department’s queues, including doctors added to it later.'
                }
              >
                <Select
                  value={catalogueLoading ? 'Loading…' : departmentName}
                  options={[ALL_DEPARTMENTS, ...departmentList.map((d) => d.name)]}
                  onChange={(label) => {
                    const picked = departmentList.find((d) => d.name === label)?.id ?? null;
                    setSelection(withDepartment(selection, picked, doctors.data ?? []));
                  }}
                  disabled={catalogueLoading}
                  height={44}
                />
              </Field>
              <div className="flex flex-col gap-2">
                <p id="display-doctors-label" className="text-label text-text-body">
                  Doctors <span className="text-text-muted font-normal">(optional)</span>
                </p>
                {doctorList.length === 0 ? (
                  <p className="text-caption text-text-muted">
                    {catalogueLoading ? 'Loading doctors…' : 'No doctors in this department yet.'}
                  </p>
                ) : (
                  <div
                    role="group"
                    aria-labelledby="display-doctors-label"
                    className="flex flex-wrap gap-2"
                  >
                    {doctorList.map((d) => (
                      <ToggleChip
                        key={d.id}
                        pressed={selection.doctorIds.includes(d.id)}
                        onChange={() => setSelection(toggleDoctor(selection, d.id))}
                      >
                        {d.name}
                      </ToggleChip>
                    ))}
                  </div>
                )}
                <p className="text-caption text-text-muted">
                  {selection.doctorIds.length === 0
                    ? `None picked: the screen shows every doctor of ${
                        selection.departmentId === null ? 'the hospital' : departmentName
                      }.`
                    : `Only the ${selection.doctorIds.length} picked doctor${
                        selection.doctorIds.length === 1 ? '' : 's'
                      } appear on the screen.`}
                </p>
              </div>
            </>
          )}
          {!device && (
            <p className="text-caption text-text-muted">
              Registering issues a key for the screen. It is shown once — enter it on the screen
              when it asks to sign in.
            </p>
          )}
        </div>
      </FormModal>
      <DisplayPreviewModal
        target={previewing ? { kind: 'draft', selection } : null}
        screenName={form.values.name}
        onClose={() => setPreviewing(false)}
      />
    </>
  );
}
