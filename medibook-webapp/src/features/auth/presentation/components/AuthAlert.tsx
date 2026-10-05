import { Icon } from '@/shared/ui/Icon';

interface AuthAlertProps {
  message: string;
}

/** The auth screens' inline error line (same treatment as the login screen's). */
export function AuthAlert({ message }: AuthAlertProps) {
  return (
    <div
      role="alert"
      className="text-caption text-danger bg-d-100 flex items-center gap-2 rounded-sm px-3 py-2.5"
    >
      <Icon name="triangle-alert" size={15} /> {message}
    </div>
  );
}
