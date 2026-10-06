import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { cn } from '@/shared/lib/cn';
import { email, minLen, phoneIN, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { useInviteStaffMutation } from '@/features/users-roles/application/queries/useInviteStaffMutation';
import { AccessSummary } from '@/features/users-roles/presentation/components/AccessSummary';
import {
  failureText,
  splitFullName,
  toE164IN,
  type RoleView,
} from '@/features/users-roles/presentation/components/usersRoles.viewModel';

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

/**
 * `POST /hospital/staff/invitations` is the only way to add staff: it emails
 * a link and the person sets their own password on accepting. There is no
 * endpoint for an OTP invite or an admin-set password, so those stay visible
 * but disabled, and the username field with them (the backend has none).
 */
const AVAILABLE_INVITE: InviteMethod = 'email';

/** Shortest acceptable staff name. */
const NAME_MIN = 3;

/** Module-level so `useForm`'s error memo stays stable across renders. */
const ADD_USER_VALIDATORS: FormValidators<AddUserForm> = {
  name: (v) => minLen(v, NAME_MIN, 'Full name'),
  email: (v) => email(v),
  roleId: (v) => required(v, 'Role'),
  // Optional field: only validated once something has been typed.
  phone: (v) => (v.trim() === '' ? undefined : phoneIN(v)),
};

interface AddUserModalProps {
  roles: readonly RoleView[];
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
  const invite = useInviteStaffMutation();

  const form = useForm<AddUserForm>({
    initial: BLANK_FORM,
    validate: ADD_USER_VALIDATORS,
    onSubmit: async (f) => {
      const role = roles.find((r) => r.id === f.roleId);
      if (!role) return;
      try {
        await invite.mutateAsync({
          ...splitFullName(f.name),
          email: f.email.trim(),
          phone: toE164IN(f.phone),
          roleCode: role.code,
        });
        toast(`Invitation sent to ${f.email.trim()} · access pending until they accept`, 'success');
        onClose();
      } catch (error) {
        toast(failureText(error, 'Could not send the invitation.'), 'error');
      }
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
            autoComplete="off"
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
            autoComplete="off"
          />
        </Field>
        <Field label="Phone" error={form.errorFor('phone')} hint="10-digit mobile, optional">
          <TextInput
            value={form.values.phone}
            onChange={(v) => form.setField('phone', v)}
            onBlur={() => form.blurField('phone')}
            placeholder="Mobile number"
            inputMode="tel"
            autoComplete="off"
          />
        </Field>
        <Field label="Username" hint="Staff sign in with their email">
          <TextInput
            value={form.values.username}
            onChange={(v) => form.setField('username', v)}
            placeholder="Not used"
            autoComplete="off"
            disabled
          />
        </Field>
        <Field label={isManual ? 'Password' : 'Password (set later)'} required={isManual}>
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
              disabled={k !== AVAILABLE_INVITE}
              className={cn(
                'text-body flex-1 cursor-pointer rounded-md py-3 text-center font-medium disabled:cursor-not-allowed disabled:opacity-50',
                form.values.invite === k
                  ? 'border-blue bg-blue-soft-bg text-blue border-2'
                  : 'border-border text-text-body border bg-white',
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="text-caption text-text-muted mt-2">
          They get an email link and set their own password when they accept. Mobile OTP and setting
          a password for them are not available yet.
        </div>
      </fieldset>
    </FormModal>
  );
}
