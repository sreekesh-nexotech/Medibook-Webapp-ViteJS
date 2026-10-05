import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Field } from '@/shared/ui/Field';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TextInput } from '@/shared/ui/TextInput';
import { toast } from '@/shared/ui/toast/toast.store';

import { isFailure } from '@/core/error/failure';

import type { StaffSession } from '@/features/auth/domain/entities/auth.types';
import { useUpdateNameMutation } from '@/features/profile/application/queries/useUpdateNameMutation';

interface ProfileNameCardProps {
  session: StaffSession;
}

/**
 * The user's own name (editable) plus email and role (read-only — they have
 * their own flows). Re-mounted by the screen whenever the user's version
 * changes, so the fields always start from the saved values.
 */
export function ProfileNameCard({ session }: ProfileNameCardProps) {
  const { user } = session;
  const update = useUpdateNameMutation();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [error, setError] = useState<string | null>(null);
  const isDirty = firstName.trim() !== user.firstName || lastName.trim() !== (user.lastName ?? '');

  const save = () => {
    if (!firstName.trim()) {
      setError('Enter your first name.');
      return;
    }
    setError(null);
    update.mutate(
      {
        surface: session.surface,
        change: { firstName: firstName.trim(), lastName: lastName.trim() },
        version: user.version,
      },
      {
        onSuccess: () => toast('Your name was updated'),
        onError: (failure) => {
          const message = isFailure(failure) ? failure.message : 'Could not save your name.';
          setError(message);
          toast(message, 'error');
        },
      },
    );
  };

  return (
    <Card>
      <SectionTitle>Profile</SectionTitle>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="First Name" required error={error}>
          <TextInput value={firstName} onChange={setFirstName} autoComplete="given-name" />
        </Field>
        <Field label="Last Name">
          <TextInput value={lastName} onChange={setLastName} autoComplete="family-name" />
        </Field>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-text-faint">Email</dt>
          <dd className="text-body text-text-strong font-medium">{user.email || '—'}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-text-faint">Role</dt>
          <dd className="text-body text-text-strong font-medium">{session.role.name}</dd>
        </div>
      </dl>
      <div className="mt-5 flex justify-end">
        <Button onClick={save} busy={update.isPending} disabled={!isDirty}>
          Save Changes
        </Button>
      </div>
    </Card>
  );
}
