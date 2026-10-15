import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import type { PermsGrid, RbacModule } from '@/features/users-roles/application/store/rbac.types';

import { accessBuckets } from './access-buckets';

interface AccessSummaryProps {
  perms: PermsGrid;
}

/** Plain-words access annotation for a role's permission grid. */
export function AccessSummary({ perms }: AccessSummaryProps) {
  const b = accessBuckets(perms);
  const line = (icon: IconName, colorClass: string, label: string, mods: RbacModule[]) =>
    mods.length > 0 ? (
      <span key={label} className="text-caption text-text-body flex items-start gap-1.75">
        <Icon name={icon} size={14} className={cn(colorClass, 'mt-px flex-none')} />
        <span>
          <b className="text-text-strong font-semibold">{label}:</b> {mods.join(', ')}
        </span>
      </span>
    ) : null;
  return (
    <div className="flex flex-col gap-1.5">
      {line('circle-check', 'text-g-800', 'Full access', b.full)}
      {line('pencil', 'text-blue', 'Limited (some actions)', b.partial)}
      {line('eye', 'text-y-800', 'View only', b.viewOnly)}
      {b.none > 0 && (
        <span className="text-caption text-text-muted flex items-center gap-1.75">
          <Icon name="circle-slash" size={14} className="text-text-faint flex-none" /> No access to{' '}
          {b.none} other {b.none === 1 ? 'module' : 'modules'}
        </span>
      )}
    </div>
  );
}
