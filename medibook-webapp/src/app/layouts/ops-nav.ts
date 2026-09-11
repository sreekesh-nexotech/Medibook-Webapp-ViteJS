/**
 * Ops console nav model + view metadata, ported 1:1 from the design
 * prototype (`src/Ops.jsx` OPS_NAV/OPS_DETAIL_PARENT/OPS_META/OPS_USER).
 */
import type { IconName } from '@/shared/ui/icon-registry';

import type { OpsStaticView, OpsView } from '@/app/router/paths';

export interface OpsNavEntry {
  readonly id: OpsStaticView;
  readonly label: string;
  readonly icon: IconName;
}

export interface OpsNavSection {
  readonly section: string;
  readonly items: readonly OpsNavEntry[];
}

export const OPS_NAV: readonly OpsNavSection[] = [
  { section: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', icon: 'house' }] },
  {
    section: 'Network',
    items: [
      { id: 'hospitals', label: 'Hospitals', icon: 'building-2' },
      { id: 'onboarding', label: 'Onboarding', icon: 'rocket' },
      { id: 'compliance', label: 'Compliance', icon: 'shield-check' },
      { id: 'plans', label: 'Subscription Plans', icon: 'layers' },
    ],
  },
  {
    section: 'Finance',
    items: [
      { id: 'billing', label: 'Billing', icon: 'receipt' },
      { id: 'settlements', label: 'Hospital Settlements', icon: 'landmark' },
    ],
  },
  {
    section: 'Insights',
    items: [
      { id: 'analytics', label: 'Usage Analytics', icon: 'trending-up' },
      { id: 'reports', label: 'Reports', icon: 'file-down' },
      { id: 'logs', label: 'Compliance Logs', icon: 'scroll-text' },
    ],
  },
  {
    section: 'Platform',
    items: [
      { id: 'users', label: 'Users & Roles', icon: 'shield-check' },
      { id: 'platform-users', label: 'Platform Users', icon: 'users' },
      { id: 'notifications', label: 'Notifications', icon: 'megaphone' },
    ],
  },
  {
    section: 'System',
    items: [{ id: 'settings', label: 'Platform Settings', icon: 'settings' }],
  },
];

/** Detail views highlight their parent nav item (design `OPS_DETAIL_PARENT`). */
export const OPS_DETAIL_PARENT: Readonly<Partial<Record<OpsView, OpsStaticView>>> = {
  'hospital-detail': 'hospitals',
  'invoice-detail': 'billing',
  'payment-detail': 'billing',
  'platform-user-detail': 'platform-users',
};

/** Topbar [title, subtitle] per ops view (design `OPS_META`). */
export const OPS_META: Readonly<Record<OpsView, readonly [string, string]>> = {
  dashboard: [
    'Operations Dashboard',
    'Platform performance and critical alerts across all hospital instances',
  ],
  hospitals: [
    'Hospital Management',
    'Onboard, monitor and manage every hospital instance on the platform',
  ],
  'hospital-detail': ['Hospital Profile', 'Instance health, plan and verification'],
  plans: ['Subscription Plans', 'Plan tiers, pricing and feature limits'],
  billing: ['Billing', 'Invoices and payment transactions across hospitals'],
  'invoice-detail': ['Invoice Detail', 'Line items, taxes and payment attempts'],
  'payment-detail': ['Payment Detail', 'Transaction reference and status history'],
  settlements: ['Hospital Settlements', 'Review and release pending settlements to hospitals'],
  analytics: ['Usage Analytics', 'Booking and platform usage across all instances'],
  logs: ['Compliance Logs', 'Audit trail of every sensitive action on the platform'],
  reports: ['Reports', 'Generate and download platform reports'],
  users: ['Users & Roles', 'Internal Medibook users and their access roles'],
  'platform-users': ['Platform Users', 'Patient accounts from the Medibook mobile app'],
  'platform-user-detail': ['Patient Account', 'Read-only account view — access is logged'],
  notifications: [
    'Notifications',
    'Home-screen banners and push notifications in the Medibook patient app',
  ],
  settings: ['Platform Settings', 'Platform-wide preferences and defaults'],
  onboarding: [
    'Hospital Onboarding',
    'Applications, KYC verification and go-live across the onboarding pipeline',
  ],
  compliance: ['Compliance', 'Registration, licence and document compliance per hospital instance'],
};

/** Browser-tab title per ops view — audit 3.9.2 (the console ran under the
 * hospital app's title). */
export function opsDocumentTitleFor(view: OpsView): string {
  const meta = OPS_META[view];
  return `${meta ? meta[0] : 'Operations'} · Medibook Operations`;
}

/** The signed-in ops identity (design `OPS_USER`). */
export const OPS_USER = {
  name: 'Riya Sharma',
  role: 'Super Admin',
  // The source bundle's avatar-riya.png is a blank/transparent placeholder, so
  // fall back to "RS" initials (the design system's photoless-avatar pattern).
  av: null,
} as const;
