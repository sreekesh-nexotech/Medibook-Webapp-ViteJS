import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

import { usePopoverDismiss } from './usePopoverDismiss';

export interface TopbarMenuItem {
  readonly key: string;
  readonly icon: IconName;
  readonly label: string;
  readonly isDanger?: boolean;
  readonly onSelect: () => void;
}

interface TopbarAccountMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  userName: string;
  /** Under the name on the trigger (the role). */
  roleName: string;
  /** Under the name inside the menu (email or role). */
  detail: string;
  items: readonly TopbarMenuItem[];
  /** Panel width token class. */
  panelWidthClass: string;
}

/**
 * The topbar account menu for both shells: a named toggle, real buttons for
 * each entry (keyboard-operable), Escape to close (01·F19).
 */
export function TopbarAccountMenu({
  open,
  onToggle,
  onClose,
  userName,
  roleName,
  detail,
  items,
  panelWidthClass,
}: TopbarAccountMenuProps) {
  const triggerRef = usePopoverDismiss(open, onClose);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        aria-label={`Account menu for ${userName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex cursor-pointer items-center gap-2.5"
      >
        <Avatar name={userName} size={38} />
        <span className="hidden flex-col items-start sm:flex">
          <span className="text-body text-text-strong font-medium">{userName}</span>
          <span className="text-caption text-text-muted">{roleName}</span>
        </span>
        <Icon name="chevron-down" size={16} className="text-text-muted" />
      </button>
      {open && (
        <>
          <div onClick={onClose} className="fixed inset-0 z-30" />
          <div
            role="menu"
            aria-label="Account"
            className={cn(
              'border-border shadow-pop absolute top-18 right-2 z-40 max-w-full overflow-hidden rounded-lg border bg-white p-2 lg:right-7',
              panelWidthClass,
            )}
          >
            <div className="flex items-center gap-2.5 px-2.5 py-2.25">
              <Avatar name={userName} size={32} />
              <div className="min-w-0">
                <div className="text-body text-text-strong font-medium">{userName}</div>
                <div className="text-caption text-text-muted">{detail}</div>
              </div>
            </div>
            <div className="bg-border-soft mx-1 my-1.5 h-px" />
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onClose();
                  item.onSelect();
                }}
                className={cn(
                  'hover:bg-grey-200 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2.25 text-left transition-colors duration-150',
                  item.isDanger ? 'text-d-500' : 'text-text-body',
                )}
              >
                <Icon name={item.icon} size={18} />
                <span className="text-body font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
