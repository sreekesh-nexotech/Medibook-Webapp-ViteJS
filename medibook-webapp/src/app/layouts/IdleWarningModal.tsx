import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';

interface IdleWarningModalProps {
  open: boolean;
  secondsLeft: number;
  /** The idle limit, for the explanation. */
  minutes: number;
  onStay: () => void;
  onSignOut: () => void;
}

/**
 * "Still there?" before an idle sign-out (SEC-01, SEC-12). Only the Stay
 * button keeps the session: Escape, the scrim and stray mouse movement do not,
 * so a screen left unattended at a shared desk always signs out.
 */
export function IdleWarningModal({
  open,
  secondsLeft,
  minutes,
  onStay,
  onSignOut,
}: IdleWarningModalProps) {
  return (
    <Modal
      open={open}
      onClose={onStay}
      dismissible={false}
      title="Still there?"
      width={440}
      footer={
        <>
          <Button variant="secondary" icon="log-out" onClick={onSignOut}>
            Sign out now
          </Button>
          <Button icon="shield-check" onClick={onStay}>
            Stay signed in
          </Button>
        </>
      }
    >
      <p className="text-body-lg text-text-body m-0 leading-[1.6]">
        This screen signs out in{' '}
        <span className="text-text-strong font-semibold tabular-nums">{secondsLeft}s</span> because
        Medibook has not been used in any tab for a while. You are signed out after {minutes}{' '}
        minutes without use.
      </p>
    </Modal>
  );
}
