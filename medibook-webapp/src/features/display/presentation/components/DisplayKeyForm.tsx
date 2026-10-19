import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/shared/ui/Button';
import { TextInput } from '@/shared/ui/TextInput';

interface DisplayKeyFormProps {
  onSubmit: (deviceKey: string) => void;
  busy: boolean;
  error: string | null;
}

/** First-run setup on the TV: paste the key issued in Hospital Settings › Display Screens. */
export function DisplayKeyForm({ onSubmit, busy, error }: DisplayKeyFormProps) {
  const [key, setKey] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (key.trim()) onSubmit(key.trim());
  };

  return (
    <main className="bg-bg-app flex h-full items-center justify-center p-6">
      <form
        onSubmit={submit}
        className="bg-bg-surface flex w-full max-w-120 flex-col gap-4 rounded-xl p-8"
      >
        <h1 className="text-h1 text-text-strong">Set up this display</h1>
        <p className="text-body text-text-muted">
          Enter the device key an admin created under Hospital Settings › Display Screens. This
          screen remembers it and signs in again after a restart.
        </p>
        <TextInput
          value={key}
          onChange={setKey}
          name="device_key"
          aria-label="Device key"
          placeholder="Device key"
          autoComplete="off"
          invalid={Boolean(error)}
          autoFocus
        />
        {error ? (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" busy={busy} disabled={!key.trim()}>
          Show the queue
        </Button>
      </form>
    </main>
  );
}
