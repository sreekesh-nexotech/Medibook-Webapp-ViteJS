import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { email, minLen, phoneIN, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useRbacStore } from '@/features/users-roles/application/store/rbac.store';
import type { Role } from '@/features/users-roles/application/store/rbac.types';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';

type InviteMethod = 'email' | 'otp' | 'manual';

interface AddUserForm {
  name: string;
  email: string;
  phone: string;
  username: string;
  roleId: string;
  invite: InviteMethod;
  password: string;
}

const BLANK_FORM: AddUserForm = {
  name: '',
  email: '',
  phone: '',
  username: '',
  roleId: '',
  invite: 'email',
  password: '',
};

const INVITES: readonly (readonly [InviteMethod, string])[] = [
  ['email', 'Email invite'],
  ['otp', 'Mobile OTP'],
  ['manual', 'Set password now'],
];

/** Shortest acceptable staff name / password. */
const NAME_MIN = 3;
const PASSWORD_MIN = 8;

/** Module-level so `useForm`'s error memo stays stable across renders. */
const ADD_USER_VALIDATORS: FormValidators<AddUserForm> = {
  name: (v) => minLen(v, NAME_MIN, 'Full name'),
  email: (v) => email(v),
  roleId: (v) => required(v, 'Role'),
  // Optional field: only validated once something has been typed.
  phone: (v) => (v.trim() === '' ? undefined : phoneIN(v)),
  password: (v, all) => (all.invite === 'manual' ? minLen(v, PASSWORD_MIN, 'Password') : undefined),
};

/** Monotonic counter for new user ids (replaces the prototype's `Date.now()`). */
let userIdSeq = 0;

interface AddUserModalProps {
  roles: readonly Role[];
  onClose: () => void;
}

/**
 * Add-user modal (design `Rbac.jsx` `AddUserModal`): the details grid, a live
 * role annotation card, and the invite-method picker. The role Select stores
 * the roleId but displays the role name — ported exactly.
 *
 * Now a `FormModal`, so Enter submits (audit 3.5.6), and every field is
 * validated inline through `useForm` instead of by one toast listing three
 * fields at once (audit 3.5.1/3.5.4). The modal is mounted only while open, so
 * it always opens blank without syncing props into state in an effect.
 */
export function AddUserModal({ roles, onClose }: AddUserModalProps) {
  const rbacAddUser = useRbacStore((s) => s.rbacAddUser);

  const form = useForm<AddUserForm>({
    initial: BLANK_FORM,
    validate: ADD_USER_VALIDATORS,
    onSubmit: (f) => {
      userIdSeq += 1;
      rbacAddUser({
        id: `u-${userIdSeq}`,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        username: f.username.trim() || f.email.trim().split('@')[0],
        roleId: f.roleId,
        status: 'Active',
        last: 'Never',
        invite: f.invite === 'manual' ? 'Accepted' : 'Pending',
      });
      toast(
        f.invite === 'manual'
          ? 'User created with a password — share it securely'
          : `User created · access pending ${f.invite === 'otp' ? 'mobile OTP' : 'email invite'}`,
        'success',
      );
      onClose();
    },
  });

  const picked = roles.find((r) => r.id === form.values.roleId);
  const isManual = form.values.invite === 'manual';

  return (
    <FormModal
      open
      onClose={onClose}
      title="Add User"
      width={560}
      submitLabel="Add User"
      busy={form.submitting}
      onSubmit={form.handleSubmit}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4.5">
        <Field label="Full Name" required error={form.errorFor('name')}>
          <TextInput
            value={form.values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. Asha Verma"
            autoComplete="name"
          />
        </Field>
        <Field label="Role" required error={form.errorFor('roleId')}>
          <Select
            value={picked?.name ?? ''}
            placeholder="Select role"
            options={roles.map((r) => r.name)}
            onChange={(name) =>
              form.setField('roleId', roles.find((r) => r.name === name)?.id ?? '')
            }
            onBlur={() => form.blurField('roleId')}
          />
        </Field>
        <Field label="Email" required error={form.errorFor('email')}>
          <TextInput
            value={form.values.email}
            onChange={(v) => form.setField('email', v)}
            onBlur={() => form.blurField('email')}
            placeholder="name@hospital.med"
            type="email"
            inputMode="email"
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" error={form.errorFor('phone')} hint="10-digit mobile, optional">
          <TextInput
            value={form.values.phone}
            onChange={(v) => form.setField('phone', v)}
            onBlur={() => form.blurField('phone')}
            placeholder="Mobile number"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>
        <Field label="Username" hint="Taken from the email if left blank">
          <TextInput
            value={form.values.username}
            onChange={(v) => form.setField('username', v)}
            placeholder="Auto from email if blank"
            autoComplete="username"
          />
        </Field>
        <Field
          label={isManual ? 'Password' : 'Password (set later)'}
          required={isManual}
          error={form.errorFor('password')}
          hint={isManual ? `At least ${PASSWORD_MIN} characters` : undefined}
        >
          <PasswordInput
            value={form.values.password}
            onChange={(v) => form.setField('password', v)}
            onBlur={() => form.blurField('password')}
            placeholder={isManual ? 'Set a password' : 'Sent via invite'}
            autoComplete="new-password"
            disabled={!isManual}
          />
        </Field>
      </div>
      {picked && (
        <div className="border-border-soft bg-bg-subtle mt-4 rounded-md border px-3.5 py-3">
          <div className="mb-1.5 flex items-center gap-1.75">
            <span className="size-2 flex-none rounded-full" style={{ background: picked.color }} />
            <span className="text-body text-text-strong font-medium">{picked.name}</span>
            {picked.desc && <span className="text-caption text-text-muted">— {picked.desc}</span>}
          </div>
          <AccessSummary perms={picked.perms} />
        </div>
      )}
      <fieldset className="mt-4.5 border-0 p-0">
        <legend className="text-body text-text-strong mb-2 p-0">How should they get access?</legend>
        <div className="flex gap-2.5">
          {INVITES.map(([k, l]) => (
            <button
              type="button"
              key={k}
              aria-pressed={form.values.invite === k}
              onClick={() => form.setField('invite', k)}
              className={cn(
                'text-body flex-1 cursor-pointer rounded-md py-3 text-center font-medium',
                form.values.invite === k
                  ? 'border-blue bg-blue-soft-bg text-blue border-2'
                  : 'border-border text-text-body border bg-white',
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>
    </FormModal>
  );
}
