import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { useOpsAct } from '@/shared/hooks/useOpsAct';
import { email, phoneIN, required } from '@/shared/lib/validate';
import { FormModal } from '@/shared/ui/FormModal';
import { Icon } from '@/shared/ui/Icon';
import { OpsField } from '@/shared/ui/OpsField';
import { Select } from '@/shared/ui/Select';
import { TextInput } from '@/shared/ui/TextInput';

import { useOnboardingStore } from '@/features/ops-hospitals/application/store/onboarding.store';
import type { HospitalAdminRole } from '@/features/ops-hospitals/application/store/onboarding.types';

interface AdminForm {
  name: string;
  email: string;
  phone: string;
  role: HospitalAdminRole;
}

const ROLES: readonly HospitalAdminRole[] = ['Hospital Admin', 'Billing Admin', 'Front Desk Lead'];

const VALIDATORS: FormValidators<AdminForm> = {
  name: (value) => required(value, "The administrator's name"),
  email: (value) => email(value),
  phone: (value) => phoneIN(value),
};

/** What each role will be able to do once the invitation is accepted. */
const ROLE_HINT: Readonly<Record<HospitalAdminRole, string>> = {
  'Hospital Admin': 'Full access to the hospital instance, including users and settings.',
  'Billing Admin': 'Payments, settlements and the hospital’s plan and invoices.',
  'Front Desk Lead': 'Appointments, the token queue and patient records.',
};

interface AdminInviteModalProps {
  open: boolean;
  hid: number;
  hospitalName: string;
  /** Admin email captured at onboarding, offered as the default. */
  defaultEmail?: string;
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Create the hospital's first administrator and queue their invitation (audit
 * SA-01: "No screen creates the hospital's first administrator, sends an
 * invitation, or requests documents").
 *
 * Nothing in this build sends email, so the wording does not pretend: the
 * invitation is **queued**, the record carries an `Invited` status with the
 * time it was queued, and the pipeline offers a resend and an "accepted"
 * confirmation. That is a visible, truthful effect — unlike a toast claiming
 * an invitation that never left.
 */
export function AdminInviteModal({
  open,
  hid,
  hospitalName,
  defaultEmail = '',
  onClose,
  onDone,
}: AdminInviteModalProps) {
  const inviteAdmin = useOnboardingStore((s) => s.inviteAdmin);
  const [busy, run] = useOpsAct();

  const form = useForm<AdminForm>({
    initial: { name: '', email: defaultEmail, phone: '', role: 'Hospital Admin' },
    validate: VALIDATORS,
    onSubmit: (values) => {
      run('invite', `Invitation queued for ${values.email.trim()}.`, () => {
        inviteAdmin(hid, {
          name: values.name,
          email: values.email,
          phone: values.phone,
          role: values.role,
        });
        onDone?.();
      });
    },
  });

  const { values } = form;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={`Create an administrator for ${hospitalName}`}
      width={520}
      onSubmit={form.handleSubmit}
      submitLabel="Create & Queue Invitation"
      busy={busy.invite}
    >
      <div className="flex flex-col gap-4.5">
        <OpsField label="Full Name" required error={form.errorFor('name')}>
          <TextInput
            value={values.name}
            onChange={(v) => form.setField('name', v)}
            onBlur={() => form.blurField('name')}
            placeholder="e.g. Dr. Ramesh Iyer"
            autoComplete="name"
            height={48}
          />
        </OpsField>
        <div className="grid gap-4 sm:grid-cols-2">
          <OpsField label="Email" required error={form.errorFor('email')}>
            <TextInput
              value={values.email}
              onChange={(v) => form.setField('email', v)}
              onBlur={() => form.blurField('email')}
              placeholder="admin@hospital.in"
              type="email"
              inputMode="email"
              autoComplete="email"
              height={48}
            />
          </OpsField>
          <OpsField label="Mobile" required error={form.errorFor('phone')}>
            <TextInput
              value={values.phone}
              onChange={(v) => form.setField('phone', v)}
              onBlur={() => form.blurField('phone')}
              placeholder="10-digit mobile"
              inputMode="tel"
              autoComplete="tel"
              maxLength={14}
              height={48}
            />
          </OpsField>
        </div>
        <OpsField label="Role" required hint={ROLE_HINT[values.role]}>
          <Select
            value={values.role}
            options={ROLES}
            onChange={(v) => form.setField('role', v as HospitalAdminRole)}
            height={48}
          />
        </OpsField>
        <div className="text-caption text-text-muted bg-y-100 flex items-start gap-2 rounded-sm px-3 py-2.5">
          <Icon name="triangle-alert" size={14} className="mt-px flex-none" /> Email delivery is not
          wired up yet. The administrator is created with an{' '}
          <b className="text-text-strong font-medium">Invited</b> status and a queued-at time, and
          the pipeline offers a resend — nothing is transmitted from here.
        </div>
      </div>
    </FormModal>
  );
}
