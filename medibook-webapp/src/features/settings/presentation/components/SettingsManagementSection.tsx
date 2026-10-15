import { useNavigate, useParams } from 'react-router-dom';

import { type HospitalStaticView, hospitalPath, isHospitalRole } from '@/app/router/paths';

import { cn } from '@/shared/lib/cn';
import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import type { IconName } from '@/shared/ui/icon-registry';

/**
 * Where the rest of the hospital's setup lives. Captions describe only what
 * exists in v2 — no branches (D-02), shift patterns, announcements or
 * hospital message templates (CLAUDE.md §12, UAT-52).
 */
const MANAGE_LINKS: readonly [string, string, HospitalStaticView, IconName][] = [
  ['Hospital Profile', 'Holiday calendar and patient-app banners', 'profile', 'building'],
  [
    'Services & Pricing',
    'Service catalogue, doctor prices, taxes and coupons',
    'services',
    'indian-rupee',
  ],
  [
    'Doctors & Departments',
    'Doctors, departments, weekly sessions and leave',
    'doctors',
    'stethoscope',
  ],
  [
    'Slots & Availability',
    'Generated slots, bulk open/block and generation runs',
    'slots',
    'calendar-clock',
  ],
  ['Messaging', 'Send booking messages and check deliveries', 'messaging', 'megaphone'],
  ['Audit Trail', 'Who changed what, when and from where', 'audit', 'scroll-text'],
  ['Users & Roles', 'Staff accounts and what each role may do', 'users', 'users'],
  ['Billing & Settlements', 'Subscription, invoices and payouts', 'settlements', 'credit-card'],
];

/** Settings › Management — links to the screens that hold the rest of the setup. */
export function SettingsManagementSection() {
  const navigate = useNavigate();
  const { role: roleParam } = useParams();
  const role = isHospitalRole(roleParam) ? roleParam : 'admin';
  return (
    <Card pad={8}>
      {MANAGE_LINKS.map(([title, caption, view, icon], i) => (
        <button
          key={title}
          type="button"
          onClick={() => navigate(hospitalPath(role, view))}
          className={cn(
            'hover:bg-grey-200 flex w-full cursor-pointer items-center gap-3.5 rounded-md border-none bg-transparent px-4.5 py-4 text-left transition-colors duration-150',
            i < MANAGE_LINKS.length - 1 && 'border-border-soft border-b',
          )}
        >
          <div className="bg-blue-soft-bg text-blue flex size-10 flex-none items-center justify-center rounded-md">
            <Icon name={icon} size={20} />
          </div>
          <div className="flex-1">
            <div className="text-body text-text-strong font-medium">{title}</div>
            <div className="text-caption text-text-muted">{caption}</div>
          </div>
          <Icon name="chevron-right" size={20} className="text-text-muted" />
        </button>
      ))}
    </Card>
  );
}
