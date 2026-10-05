import { Spinner } from '@/shared/ui/Spinner';

/** Shown inside the hospital shell while a screen's code chunk downloads. */
export function ScreenLoading() {
  return (
    <div className="text-text-muted flex justify-center py-16">
      <Spinner size={28} label="Loading" />
    </div>
  );
}
