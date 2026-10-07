import { useForm, type FormValidators } from '@/shared/hooks/useForm';
import { required } from '@/shared/lib/validate';
import { Field } from '@/shared/ui/Field';
import { FormErrorSummary } from '@/shared/ui/FormErrorSummary';
import { FormModal } from '@/shared/ui/FormModal';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import type { BankAccount } from '@/features/settings/domain/entities/settings.entities';
import { useSaveBankAccountMutation } from '@/features/settings/application/queries/useSaveBankAccountMutation';
import {
  type BankForm,
  bankInput,
  toBankForm,
} from '@/features/settings/application/store/settings.form';

const ACCOUNT_NUMBER_PATTERN = /^\d{6,20}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_PATTERN = /^[\w.-]{2,256}@[A-Za-z]{2,64}$/;

function validators(hasStoredNumber: boolean): FormValidators<BankForm> {
  return {
    accountName: (v) => required(v, 'Account holder name'),
    bank: (v) => required(v, 'Bank'),
    account: (v) => {
      const number = v.replace(/\s/g, '');
      if (number === '') return hasStoredNumber ? undefined : 'Account number is required.';
      return ACCOUNT_NUMBER_PATTERN.test(number)
        ? undefined
        : 'Account number must be 6–20 digits.';
    },
    ifsc: (v) =>
      IFSC_PATTERN.test(v.trim().toUpperCase())
        ? undefined
        : 'IFSC looks like HDFC0001234 — 4 letters, a zero, then 6 characters.',
    upi: (v) =>
      v.trim() === '' || UPI_PATTERN.test(v.trim()) ? undefined : 'UPI ID looks like name@bank.',
  };
}

const NEW_ACCOUNT_VALIDATORS = validators(false);
const EDIT_ACCOUNT_VALIDATORS = validators(true);

const SERVER_FIELDS = {
  account_holder: 'accountName',
  bank_name: 'bank',
  account_number: 'account',
  ifsc: 'ifsc',
  upi_id: 'upi',
} as const;

interface BankAccountModalProps {
  /** `null` adds an account. */
  account: BankAccount | null;
  onClose: () => void;
}

/**
 * Add or edit a payout bank account. The full number is never returned —
 * leaving it blank keeps the stored one; a new number must be verified by
 * Medibook finance again before payouts use it (decision 4).
 */
export function BankAccountModal({ account, onClose }: BankAccountModalProps) {
  const save = useSaveBankAccountMutation();
  const form = useForm<BankForm>({
    initial: toBankForm(account),
    validate: account ? EDIT_ACCOUNT_VALIDATORS : NEW_ACCOUNT_VALIDATORS,
    onSubmit: async (values) => {
      try {
        await save.mutateAsync({ input: bankInput(values), existing: account });
        toast(account ? 'Bank account saved' : 'Bank account added', 'success');
        onClose();
      } catch (error) {
        toast(
          form.applyServerErrors(
            error,
            { fields: SERVER_FIELDS },
            'The account could not be saved.',
          ),
          'error',
        );
      }
    },
  });
  const v = form.values;
  return (
    <FormModal
      open
      onClose={onClose}
      title={account ? 'Edit Bank Account' : 'Add Bank Account'}
      width={620}
      onSubmit={form.handleSubmit}
      submitLabel={account ? 'Save' : 'Add Account'}
      busy={form.submitting}
    >
      <div className="flex flex-col gap-4.5">
        <FormErrorSummary messages={form.serverSummary} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Account holder name" required error={form.errorFor('accountName')}>
            <TextInput value={v.accountName} onChange={(x) => form.setField('accountName', x)} />
          </Field>
          <Field label="Bank" required error={form.errorFor('bank')}>
            <TextInput value={v.bank} onChange={(x) => form.setField('bank', x)} />
          </Field>
          <Field
            label="Account number"
            required={!account}
            error={form.errorFor('account')}
            hint={
              account
                ? `Stored number ends in ${account.accountLast4}. Leave blank to keep it; a new number is verified again.`
                : undefined
            }
          >
            <TextInput
              value={v.account}
              onChange={(x) => form.setField('account', x)}
              placeholder={account ? `•••• ${account.accountLast4}` : undefined}
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
          <Field label="IFSC" required error={form.errorFor('ifsc')}>
            <TextInput value={v.ifsc} onChange={(x) => form.setField('ifsc', x.toUpperCase())} />
          </Field>
          <Field label="Settlement UPI ID" error={form.errorFor('upi')} hint="Optional.">
            <TextInput value={v.upi} onChange={(x) => form.setField('upi', x)} />
          </Field>
        </div>
      </div>
    </FormModal>
  );
}
