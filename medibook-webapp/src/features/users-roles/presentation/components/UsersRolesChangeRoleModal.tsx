import { useState } from 'react';

import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import { useStaffCountersQuery } from '@/features/users-roles/application/queries/useStaffCountersQuery';
import { useUpdateStaffDetailsMutation } from '@/features/users-roles/application/queries/useUpdateStaffDetailsMutation';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';
import {
  failureText,
  type RoleView,
  type UserRow,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

/** Backend limits (`rbac/serializers/staff_patch.py`). */
const EMPLOYEE_CODE_MAX = 50;
const DESIGNATION_MAX = 100;

const NO_COUNTER = 'No default counter';

interface UsersRolesChangeRoleModalProps {
  user: UserRow;
  roles: readonly RoleView[];
  /** The signed-in user's own row: the role cannot be changed (B2 refuses it, UAT-24). */
  isSelf: boolean;
  onClose: () => void;
}

/** Backend code for an edit against a row that changed since it was read. */
const CONFLICT_VERSION = 'CONFLICT_VERSION';

/** Field-error keys the staff PATCH answers with, per form field (08 F6). */
type EditField = 'role' | 'employeeCode' | 'designation' | 'counter';

const FIELD_KEYS: Readonly<Record<string, EditField>> = {
  role_code: 'role',
  employee_code: 'employeeCode',
  designation: 'designation',
  counter_id: 'counter',
};

/** Blank → `null`, so clearing a field clears it on the server. */
function orNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Edit what the hospital holds about a staff member — role, employee code,
 * designation and default counter (`PATCH /hospital/staff/{id}` with
 * `If-Match`; name, email and phone belong to the person's own account). The
 * backend refuses a change that would leave the hospital without an active
 * admin, or one made against a stale row, and that refusal is shown as is.
 */
export function UsersRolesChangeRoleModal({
  user,
  roles,
  isSelf,
  onClose,
}: UsersRolesChangeRoleModalProps) {
  const save = useUpdateStaffDetailsMutation();
  const countersQuery = useStaffCountersQuery();
  const counters = countersQuery.data ?? [];
  const [roleId, setRoleId] = useState(user.roleId);
  const [employeeCode, setEmployeeCode] = useState(user.employeeCode ?? '');
  const [designation, setDesignation] = useState(user.designation ?? '');
  const [counterId, setCounterId] = useState<string | null>(user.counterId);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditField, string>>>({});

  const picked = roles.find((r) => r.id === roleId);
  const unchanged =
    roleId === user.roleId &&
    orNull(employeeCode) === user.employeeCode &&
    orNull(designation) === user.designation &&
    counterId === user.counterId;
  const counterName = counters.find((c) => c.id === counterId)?.name;

  const submit = (): void => {
    if (!picked || unchanged) {
      onClose();
      return;
    }
    save.mutate(
      {
        staffId: user.id,
        details: {
          roleCode: picked.code,
          employeeCode: orNull(employeeCode),
          designation: orNull(designation),
          counterId,
        },
        version: user.version,
      },
      {
        onSuccess: () => {
          toast(
            roleId === user.roleId ? `${user.name} updated` : `${user.name} is now ${picked.name}`,
            'success',
          );
          onClose();
        },
        onError: (failure) => {
          // Each server field error lands under its own field; anything
          // else (last admin, self role change, a stale row) above the form.
          const mapped: Partial<Record<EditField, string>> = {};
          if (isFailure(failure)) {
            for (const [key, messages] of Object.entries(failure.fieldErrors)) {
              const field = FIELD_KEYS[key];
              if (field && messages[0]) mapped[field] = messages[0];
            }
          }
          setFieldErrors(mapped);
          setError(
            Object.keys(mapped).length > 0
              ? null
              : isFailure(failure) && failure.code === CONFLICT_VERSION
                ? `${user.name} was changed by someone else in the meantime. Close this and open it again to edit the latest details.`
                : failureText(failure, 'Could not save the changes.'),
          );
        },
      },
    );
  };

  return (
    <FormModal
      open
      onClose={onClose}
      title={`Edit ${user.name}`}
      width={520}
      submitLabel="Save Changes"
      busy={save.isPending}
      disabled={unchanged}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="text-body text-d-700 bg-d-100 rounded-md px-3.5 py-2.5">
            {error}
          </div>
        )}
        <Field
          label="Role"
          required
          error={fieldErrors.role}
          hint={isSelf ? 'You cannot change your own role — another administrator can.' : undefined}
        >
          <Select
            value={picked?.name ?? ''}
            placeholder="Select role"
            options={roles.map((r) => r.name)}
            disabled={isSelf}
            onChange={(name) => {
              setRoleId(roles.find((r) => r.name === name)?.id ?? user.roleId);
              setError(null);
              setFieldErrors({});
            }}
          />
        </Field>
        {picked && (
          <div className="border-border-soft bg-bg-subtle rounded-md border px-3.5 py-3">
            <div className="mb-1.5 flex items-center gap-1.75">
              <span
                className="size-2 flex-none rounded-full"
                style={{ background: picked.color }}
              />
              <span className="text-body text-text-strong font-medium">{picked.name}</span>
              <span className="text-caption text-text-muted">— {picked.desc}</span>
            </div>
            <AccessSummary perms={picked.perms} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Employee Code"
            hint="The hospital's own staff ID."
            error={fieldErrors.employeeCode}
          >
            <TextInput
              value={employeeCode}
              maxLength={EMPLOYEE_CODE_MAX}
              placeholder="e.g. LKS-05"
              onChange={setEmployeeCode}
            />
          </Field>
          <Field label="Designation" error={fieldErrors.designation}>
            <TextInput
              value={designation}
              maxLength={DESIGNATION_MAX}
              placeholder="e.g. Senior Receptionist"
              onChange={setDesignation}
            />
          </Field>
        </div>
        <Field
          label="Default Counter"
          error={fieldErrors.counter}
          hint={
            countersQuery.isError
              ? 'Counters could not be loaded; the current one is kept.'
              : 'Where their payments and tokens are recorded by default.'
          }
        >
          <Select
            value={counterName ?? NO_COUNTER}
            options={[NO_COUNTER, ...counters.filter((c) => c.isActive).map((c) => c.name)]}
            disabled={countersQuery.isError}
            onChange={(name) => setCounterId(counters.find((c) => c.name === name)?.id ?? null)}
          />
        </Field>
        <div className="text-caption text-text-muted">
          Name, email and phone belong to {user.name}&apos;s own account and are edited from My
          Account.
        </div>
      </div>
    </FormModal>
  );
}
