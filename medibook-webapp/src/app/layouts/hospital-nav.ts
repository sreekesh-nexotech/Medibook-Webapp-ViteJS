/**
 * Hospital shell nav model + view metadata, ported 1:1 from the design
 * prototype (`src/Sidebar.jsx` NAV_MODEL/viewAllowed/ROLE_USERS and
 * `Medibook mbAdmin.html` VIEW_TITLE/titleFor/subFor/NAV_PARENT).
 */
import type { IconName } from '@/shared/ui/icon-registry';

import type { HospitalRole, HospitalStaticView, HospitalView } from '@/app/router/paths';

import type { RbacModule } from '@/features/users-roles/application/store/rbac.types';

/** Views that appear as sidebar items (every static view except "create"). */
export type HospitalNavView = Exclude<HospitalStaticView, 'create'>;

export interface HospitalNavEntry {
  readonly id: HospitalNavView;
  readonly label: string;
  readonly icon: IconName;
  readonly roles: readonly HospitalRole[];
}

export interface HospitalNavSection {
  readonly section: string;
  readonly items: readonly HospitalNavEntry[];
}

export const NAV_MODEL: readonly HospitalNavSection[] = [
  {
    section: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'house', roles: ['receptionist', 'admin'] },
    ],
  },
  {
    section: 'Front Desk',
    items: [
      {
        id: 'appointments',
        label: 'Appointments',
        icon: 'calendar-days',
        roles: ['receptionist', 'admin'],
      },
      { id: 'patients', label: 'Patients', icon: 'users', roles: ['receptionist', 'admin'] },
      { id: 'token', label: 'Token Management', icon: 'ticket', roles: ['receptionist', 'admin'] },
    ],
  },
  {
    section: 'Billing',
    items: [
      { id: 'payments', label: 'Payments', icon: 'wallet', roles: ['receptionist', 'admin'] },
      { id: 'settlements', label: 'Billing & Settlements', icon: 'scale', roles: ['admin'] },
    ],
  },
  {
    section: 'Management',
    items: [
      { id: 'doctors', label: 'Doctors & Departments', icon: 'stethoscope', roles: ['admin'] },
      { id: 'slots', label: 'Slots & Availability', icon: 'calendar-clock', roles: ['admin'] },
      { id: 'services', label: 'Services & Pricing', icon: 'indian-rupee', roles: ['admin'] },
      { id: 'users', label: 'Users & Roles', icon: 'shield-check', roles: ['admin'] },
      { id: 'reports', label: 'Reports', icon: 'file-text', roles: ['admin'] },
    ],
  },
  {
    section: 'System',
    items: [
      { id: 'profile', label: 'Hospital Profile', icon: 'building', roles: ['admin'] },
      { id: 'settings', label: 'Hospital Settings', icon: 'settings', roles: ['admin'] },
      { id: 'messaging', label: 'Messaging', icon: 'megaphone', roles: ['admin'] },
      { id: 'audit', label: 'Audit Trail', icon: 'scroll-text', roles: ['admin'] },
      {
        id: 'help',
        label: 'Help & Support',
        icon: 'circle-help',
        roles: ['receptionist', 'admin'],
      },
    ],
  },
];

/**
 * Which RBAC module gates each nav item — audit 2.4 / X-01: "no screen ever
 * looks different for a limited role". `HospitalSidebar` hides an item whose
 * module the current role cannot `view`, using the *existing* permission grid
 * (see `@/shared/hooks/usePermission` for the key vocabulary).
 *
 * An item with no entry here is always visible (Help & Support has no module).
 */
export const NAV_PERMISSION_MODULE: Readonly<Partial<Record<HospitalNavView, RbacModule>>> = {
  dashboard: 'Dashboard',
  appointments: 'Appointments',
  patients: 'Patients',
  token: 'Token Management',
  payments: 'Payments',
  settlements: 'Billing & Settlements',
  billing: 'Billing & Settlements',
  doctors: 'Doctors & Departments',
  slots: 'Doctors & Departments',
  services: 'Hospital Settings',
  users: 'Users & Roles',
  reports: 'Reports',
  profile: 'Hospital Settings',
  settings: 'Hospital Settings',
  messaging: 'Hospital Settings',
  audit: 'Hospital Settings',
};

/** Detail/child views highlight their parent nav item (design `NAV_PARENT`). */
export const NAV_PARENT: Readonly<Partial<Record<HospitalView, HospitalNavView>>> = {
  create: 'appointments',
  'patient-detail': 'patients',
  'doctor-detail': 'doctors',
};

/** Whether a role may see a view (design `viewAllowed`, incl. the parent mapping). */
export function viewAllowed(role: HospitalRole, view: HospitalView): boolean {
  const base = NAV_PARENT[view] ?? view;
  for (const s of NAV_MODEL) {
    for (const it of s.items) {
      if (it.id === base) return it.roles.includes(role);
    }
  }
  return true;
}

/** The demo identity behind each hospital role (design `ROLE_USERS`). */
export const ROLE_USERS: Readonly<
  Record<HospitalRole, { readonly name: string; readonly role: string }>
> = {
  receptionist: { name: 'Riya Menon', role: 'Receptionist' },
  admin: { name: 'Dr. S. Nair', role: 'Administrator' },
};

/** Topbar titles per view (design `VIEW_TITLE`; dashboard is role-dependent). */
const VIEW_TITLE: Readonly<Partial<Record<HospitalView, string>>> = {
  appointments: 'Appointments',
  create: 'New Appointment',
  patients: 'Patients',
  'patient-detail': 'Patient Profile',
  token: 'Live Token Queue',
  payments: 'Payments',
  settlements: 'Billing & Settlements',
  doctors: 'Doctors & Departments',
  'doctor-detail': 'Doctor Profile',
  reports: 'Reports & Analytics',
  settings: 'Hospital Settings',
  help: 'Help & Support',
  users: 'Users & Roles',
  slots: 'Slots & Availability',
  profile: 'Hospital Profile',
  services: 'Services & Pricing',
  messaging: 'Messaging',
  audit: 'Audit Trail',
  billing: 'Plan & Billing',
};

/** Topbar title for a role + view (design `titleFor`). */
export function titleFor(role: HospitalRole, view: HospitalView): string {
  if (view === 'dashboard') return role === 'receptionist' ? 'Front Desk' : 'Hospital Dashboard';
  return VIEW_TITLE[view] ?? 'mbAdmin';
}

/** Topbar subtitle for a role + view (design `subFor`). */
export function subFor(role: HospitalRole, view: HospitalView): string | null {
  if (view === 'dashboard')
    return role === 'receptionist' ? 'Welcome back, Riya' : 'Hospital-wide overview';
  if (view === 'create') return 'Book a walk-in or register an online arrival';
  return null;
}

/** Browser-tab title for a role + view — audit 3.9.2. */
export function documentTitleFor(role: HospitalRole, view: HospitalView): string {
  return `${titleFor(role, view)} · Medibook mbAdmin`;
}
