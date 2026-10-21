import { useState } from 'react';

import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Modal } from '@/shared/ui/Modal';

import {
  displayAddress,
  displaySetupLink,
} from '@/features/settings/presentation/components/displayLinks';

interface DeviceKeyModalProps {
  /** The screen's name and raw key — `null` closes the dialog. */
  issued: { readonly name: string; readonly key: string } | null;
  onClose: () => void;
}

/** Which of the two values was last copied, for the button label. */
type Copied = 'key' | 'link' | null;

/**
 * Shows a display screen's key exactly once (register / rotate). The key is
 * never stored by the app and cannot be shown again: closing the dialog
 * forgets it; a lost key means rotating to a new one. It also says where the
 * TV opens the display, and offers a setup link with the key filled in.
 */
export function DeviceKeyModal({ issued, onClose }: DeviceKeyModalProps) {
  const [copied, setCopied] = useState<Copied>(null);
  const origin = window.location.origin;
  const copy = (what: Exclude<Copied, null>, text: string): void => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(what),
      () => setCopied(null),
    );
  };
  const close = (): void => {
    setCopied(null);
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
            On <span className="font-semibold">{issued.name}</span>, open{' '}
            <span className="font-semibold break-all">{displayAddress(origin)}</span> in the browser
            and enter this key. It is shown only now — Medibook keeps only a fingerprint of it.
          </p>
          <div className="border-border bg-grey-200 flex items-center gap-2 rounded-md border px-3.5 py-3">
            <code className="text-body text-text-strong flex-1 font-mono break-all select-all">
              {issued.key}
            </code>
            <Button
              size="sm"
              variant="secondary"
              icon="copy"
              onClick={() => copy('key', issued.key)}
            >
              {copied === 'key' ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-caption text-text-muted flex-1">
              Or open this setup link on the screen once — it signs in with the key already filled
              in.
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon="copy"
              onClick={() => copy('link', displaySetupLink(origin, issued.key))}
            >
              {copied === 'link' ? 'Copied' : 'Copy setup link'}
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
