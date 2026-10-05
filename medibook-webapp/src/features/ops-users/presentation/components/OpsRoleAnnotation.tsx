import type { OpsStaffRole } from '@/features/ops-users/domain/entities/opsUsers.types';
import { Icon } from '@/shared/ui/Icon';

import { roleSummary, type CatalogueModule } from './opsUsers.display';

interface OpsRoleAnnotationProps {
  role: OpsStaffRole;
  /** The permission catalogue by module, to read the role's grid against. */
  modules: readonly CatalogueModule[];
}

/**
 * Role annotation card — the plain-language "can / no access" summary shown
 * wherever a role is picked, so access is explicit before assigning (design
 * `OpsRoleAnnotation`). Built from the role's real permission grid.
 */
export function OpsRoleAnnotation({ role, modules }: OpsRoleAnnotationProps) {
  const { can, cant } = roleSummary(role, modules);
  return (
    <div className="border-border-soft bg-bg-subtle flex flex-col gap-1.75 rounded-md border px-3.5 py-3">
      <span className="text-body text-text-strong font-medium">
        {role.name} —{' '}
        <span className="text-text-body font-normal">
          {role.isSystem ? 'System role.' : 'Custom role.'}
        </span>
      </span>
      {can.map((g) => (
        <span key={g.heading} className="text-caption text-text-body flex items-start gap-1.75">
          <Icon name="circle-check" size={14} className="text-g-600 mt-px flex-none" />{' '}
          <span>
            <span className="capitalize">{g.heading}</span>: {g.modules.join(', ')}
          </span>
        </span>
      ))}
      {cant.length > 0 && (
        <span className="text-caption text-text-muted flex items-start gap-1.75">
          <Icon name="circle-slash" size={14} className="text-text-faint mt-px flex-none" /> No
          access: {cant.join(', ')}
        </span>
      )}
    </div>
  );
}
