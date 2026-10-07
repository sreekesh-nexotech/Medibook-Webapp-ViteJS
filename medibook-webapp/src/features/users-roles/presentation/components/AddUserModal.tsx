import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { email, minLen, phoneIN, required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
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

interface AddUserForm {
  name: string;
  email: string;
  phone: string;
  roleId: string;
}

const BLANK_FORM: AddUserForm = {
  name: '',
  email: '',
  phone: '',
  roleId: '',
};

/*
 * `POST /hospital/staff/invitations` is the only way to add staff: it emails a
 * link and the person sets their own password on accepting. There is no OTP
 * invite, admin-set password or username in the backend, so the modal offers
 * none of them (PRD-05) and says how access works instead.
 */

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
        toast(failureText(error, 'Could not send the invitation.'), 'error', error);
      }
    },
  });

  const picked = roles.find((r) => r.id === form.values.roleId);

  return (
    <FormModal
      dirty={form.isDirty}
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
      <p className="text-caption text-text-muted m-0 mt-4.5 flex items-start gap-1.75">
        <Icon name="mail" size={14} className="mt-0.5 flex-none" />
        <span>
          They get an email invitation, valid for 7 days, and set their own password when they
          accept. They sign in with this email address. Mobile OTP invites and setting a password
          for them are coming later.
        </span>
      </p>
    </FormModal>
  );
}
