import { Spinner } from '@/shared/ui/Spinner';

/** Full-page wait while a guard validates the stored session with `/me`. */
export function SessionLoading() {
  return (
    <div className="bg-bg-app text-text-muted flex h-full items-center justify-center">
      <Spinner size={32} label="Checking your session" />
    </div>
  );
}
