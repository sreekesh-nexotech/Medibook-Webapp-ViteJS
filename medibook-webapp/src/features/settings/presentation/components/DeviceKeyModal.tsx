import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';

interface DeviceKeyModalProps {
  /** The screen's name and raw key — `null` closes the dialog. */
  issued: { readonly name: string; readonly key: string } | null;
  onClose: () => void;
}

/**
 * Shows a display screen's key exactly once (register / rotate). The key is
 * never stored by the app and cannot be shown again: closing the dialog
 * forgets it; a lost key means rotating to a new one.
 */
export function DeviceKeyModal({ issued, onClose }: DeviceKeyModalProps) {
  const [copied, setCopied] = useState(false);
  const copy = (): void => {
    if (!issued) return;
    navigator.clipboard.writeText(issued.key).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  const close = (): void => {
    setCopied(false);
    onClose();
  };
  return (
    <Modal
      open={issued !== null}
      onClose={close}
      title="Display screen key"
      width={520}
      dismissible={false}
      footer={<Button onClick={close}>I have saved the key</Button>}
    >
      {issued && (
        <div className="flex flex-col gap-3.5">
          <p className="text-body text-text-body">
            Enter this key on <span className="font-semibold">{issued.name}</span> when it asks to
            sign in. It is shown only now — Medibook keeps only a fingerprint of it.
          </p>
          <div className="border-border bg-grey-200 flex items-center gap-2 rounded-md border px-3.5 py-3">
            <code className="text-body text-text-strong flex-1 font-mono break-all select-all">
              {issued.key}
            </code>
            <Button size="sm" variant="secondary" icon="copy" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-caption text-text-muted flex items-start gap-1.5">
            <Icon name="lock" size={13} className="mt-0.5 flex-none" /> Lost it? Rotate the key to
            issue a new one; the old one stops working at once.
          </p>
        </div>
      )}
    </Modal>
  );
}
