import { cn } from '@/shared/lib/cn';
import { Icon } from '@/shared/ui/Icon';

import type { HospitalView } from '@/app/router/paths';

import type { HospitalNavEntry, HospitalNavView } from './hospital-nav';

interface HospitalNavItemProps {
  item: HospitalNavEntry;
  active: HospitalView;
  onClick: (view: HospitalNavView) => void;
  collapsed: boolean;
}

/** One sidebar nav row (design `NavItem` in `Sidebar.jsx`). */
export function HospitalNavItem({ item, active, onClick, collapsed }: HospitalNavItemProps) {
  const isActive = active === item.id;
  return (
    <button
      type="button"
      onClick={() => onClick(item.id)}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'text-body mx-2.5 flex cursor-pointer items-center gap-3.5 rounded-md transition-colors duration-150',
        collapsed ? 'justify-center py-2.75' : 'justify-start px-4 py-2.5',
        isActive
          ? 'bg-blue-soft-bg text-text-navy font-semibold'
          : 'text-text-muted hover:bg-grey-200 font-medium',
      )}
    >
      <Icon name={item.icon} size={20} />
      {!collapsed && item.label}
    </button>
  );
}
