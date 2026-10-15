import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { PASSWORD_MIN_LENGTH } from '@/features/auth/presentation/components/authPassword';
import { useChangePasswordMutation } from '@/features/profile/application/queries/useChangePasswordMutation';

interface ProfilePasswordCardProps {
  surface: AuthSurface;
}

interface PasswordErrors {
  readonly current?: string;
  readonly next?: string;
  readonly confirm?: string;
}

/** Change password: current + new + confirm. The server signs every other device out. */
export function ProfilePasswordCard({ surface }: ProfilePasswordCardProps) {
  const change = useChangePasswordMutation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<PasswordErrors>({});

  const save = () => {
    const found: PasswordErrors = {
      current: current ? undefined : 'Enter your current password.',
      next:
        next.length < PASSWORD_MIN_LENGTH
          ? `Use at least ${PASSWORD_MIN_LENGTH} characters.`
          : undefined,
      confirm: next === confirm ? undefined : 'The two passwords do not match.',
    };
    setErrors(found);
    if (found.current || found.next || found.confirm) return;
    change.mutate(
      { surface, change: { currentPassword: current, newPassword: next } },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
          toast('Password changed. Your other devices were signed out.');
        },
        onError: (failure) => {
          if (!isFailure(failure)) {
            toast('Could not change your password.', 'error');
            return;
          }
          setErrors({
            current: failure.fieldErrors.current_password?.join(' '),
            next: failure.fieldErrors.new_password?.join(' '),
          });
          toast(failure.message, 'error', failure);
        },
      },
    );
  };

  return (
    <Card>
      <SectionTitle>Password</SectionTitle>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="Current Password" required error={errors.current}>
          <PasswordInput value={current} onChange={setCurrent} autoComplete="current-password" />
        </Field>
        <Field
          label="New Password"
          required
          error={errors.next}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
        >
          <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
        </Field>
        <Field label="Confirm New Password" required error={errors.confirm}>
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </Field>
      </div>
      <div className="mt-5 flex justify-end">
        <Button icon="key-round" onClick={save} busy={change.isPending}>
          Change Password
        </Button>
      </div>
    </Card>
  );
}
