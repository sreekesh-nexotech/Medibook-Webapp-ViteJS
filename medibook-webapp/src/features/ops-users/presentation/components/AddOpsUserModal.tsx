import { useState } from 'react';

import type { AddOpsUserForm } from '@/features/ops-users/application/store/opsUsers.store';
import { useOpsUsersStore } from '@/features/ops-users/application/store/opsUsers.store';
import type { OpsRole, OpsUser } from '@/features/ops-users/application/store/opsUsers.types';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { email as vEmail, required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { OpsRoleAnnotation } from './OpsRoleAnnotation';

/** Assignable roles, in the design's Select order. */
const OPS_ROLE_OPTIONS: readonly OpsRole[] = ['Super Admin', 'Finance Admin', 'Support', 'Auditor'];

/** The role a brand-new invite starts on (narrowest useful profile). */
const DEFAULT_NEW_ROLE: OpsRole = 'Support';

interface AddUserErrors {
  name?: string | null;
  email?: string | null;
}

interface AddOpsUserModalProps {
  open: boolean;
  /** The user being edited, or null/omitted to invite a new one. */
  user?: OpsUser | null;
  onClose: () => void;
  onDone: () => void;
}

/** The form this modal opens on — an empty invite, or the user being edited. */
function initialForm(user: OpsUser | null | undefined): AddOpsUserForm {
  if (!user) return { name: '', email: '', role: DEFAULT_NEW_ROLE };
  return { name: user.name, email: user.email, role: user.role };
}

/**
 * Add / edit an internal Medibook user — a validated form with a live role
 * annotation.
 *
 * State is initialised from props instead of synced in an effect: the screen
 * keys this component by which user is open, so React remounts it with a
 * fresh form (no `set-state-in-effect`, no stale first render). Built on
 * `FormModal`, so Enter submits (audit 3.4.5).
 */
export function AddOpsUserModal({ open, user, onClose, onDone }: AddOpsUserModalProps) {
  const addUser = useOpsUsersStore((s) => s.addUser);
  const updateUser = useOpsUsersStore((s) => s.updateUser);
  const [f, setF] = useState<AddOpsUserForm>(() => initialForm(user));
  const [err, setErr] = useState<AddUserErrors>({});
  const [busy, run] = useOpsAct();

  const editing = user != null;

  const submit = () => {
    const e: AddUserErrors = {
      name: required(f.name, 'Full name'),
      email: vEmail(f.email),
    };
    setErr(e);
    if (e.name || e.email) return;
    run('au', editing ? `${f.name} updated.` : `${f.name} added.`, () => {
      if (user) updateUser(user.id, f);
      else addUser(f);
      onDone();
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit User' : 'Add User'}
      width={460}
      onSubmit={submit}
      submitLabel={busy.au ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save User' : 'Add User'}
      busy={Boolean(busy.au)}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Full Name" required error={err.name}>
          <TextInput
            value={f.name}
            name="name"
            autoComplete="name"
            onChange={(v) => {
              setF({ ...f, name: v });
              setErr({ ...err, name: null });
            }}
            placeholder="e.g. Kavya Reddy"
            height={48}
          />
        </OpsField>
        <OpsField label="Work Email" required error={err.email}>
          <TextInput
            value={f.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            onChange={(v) => {
              setF({ ...f, email: v });
              setErr({ ...err, email: null });
            }}
            placeholder="name@medibook.in"
            height={48}
          />
        </OpsField>
        <OpsField label="Role">
          <Select
            value={f.role}
            options={OPS_ROLE_OPTIONS}
            onChange={(v) => setF({ ...f, role: OPS_ROLE_OPTIONS.find((r) => r === v) ?? f.role })}
            height={48}
          />
        </OpsField>
        <OpsRoleAnnotation role={f.role} />
        <div className="bg-blue-soft-bg text-caption text-text-muted flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="info" size={14} className="mt-px flex-none" />
          {editing
            ? 'Role changes take effect at their next sign-in, and are written to Compliance Logs.'
            : 'An invite email is sent. The account stays Pending until they set a password and enable 2FA.'}
        </div>
      </div>
    </FormModal>
  );
}
