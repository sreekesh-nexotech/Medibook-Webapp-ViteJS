import type { FilterSelectGroup } from '@/shared/ui/FilterSelect';

/** A resource type services record by name, and how the console shows it. */
type ResourceDef = readonly [label: string, type: string];

/**
 * The resource types the backend's services record by name (`audit.record`),
 * grouped by area for the Resource menu. `/platform/logs` filters on one exact
 * type, so each entry is one type. Request rows name the view that handled the
 * request instead (e.g. `PlatformLoginView`); those are filtered by clicking a
 * row's resource.
 */
const RESOURCE_GROUPS: readonly {
  readonly label: string;
  readonly types: readonly ResourceDef[];
}[] = [
  {
    label: 'Hospitals',
    types: [
      ['Hospitals', 'hospital'],
      ['Onboarding cases', 'onboarding_case'],
      ['Onboarding checklist', 'onboarding_checklist_item'],
      ['Hospital settings', 'hospital_settings'],
      ['Bank accounts', 'hospital_bank_account'],
      ['Counters', 'hospital_counter'],
      ['Hospital banners', 'hospital_banner'],
      ['Display devices', 'display_device'],
    ],
  },
  {
    label: 'Staff and access',
    types: [
      ['Hospital staff accounts', 'hospital_staff'],
      ['Hospital invitations', 'hospital_admin_invitation'],
      ['Hospital roles', 'hospital_role'],
      ['Medibook staff accounts', 'platform_staff'],
      ['Medibook roles', 'platform_role'],
      ['User accounts', 'user'],
    ],
  },
  {
    label: 'Doctors and schedules',
    types: [
      ['Doctors', 'doctor'],
      ['Doctor services', 'doctor_service'],
      ['Doctor leave', 'doctor_leave'],
      ['Doctor date changes', 'doctor_date_exception'],
      ['Doctor reviews', 'doctor_review'],
      ['Departments', 'department'],
      ['Services', 'service'],
      ['Holidays', 'holiday'],
      ['Slots', 'slot'],
    ],
  },
  {
    label: 'Billing and settlements',
    types: [
      ['Plans', 'plan'],
      ['Plan changes', 'plan_change_request'],
      ['Subscriptions', 'hospital_subscription'],
      ['Subscription invoices', 'subscription_invoice'],
      ['Coupons', 'coupon'],
      ['Tax rates', 'tax_rate'],
      ['Settlement periods', 'settlement_period'],
      ['Settlement adjustments', 'settlement_adjustment'],
      ['Payouts', 'payout'],
      ['Payout runs', 'payout_run'],
      ['Statements', 'platform_statement'],
    ],
  },
  {
    label: 'App content',
    types: [
      ['App banners', 'hospital_banners'],
      ['Ambulance providers', 'ambulance_providers'],
      ['FAQs', 'faq_entries'],
      ['Legal documents', 'legal_documents'],
      ['Locations', 'locations'],
      ['Default tax rates', 'tax_rates'],
      ['Feature flags', 'feature_flags'],
    ],
  },
  {
    label: 'Data and compliance',
    types: [
      ['Data requests', 'data_subject_request'],
      ['Data retention', 'retention'],
      ['Report schedules', 'report_schedule'],
    ],
  },
];

const LABEL_BY_TYPE = new Map(RESOURCE_GROUPS.flatMap((g) => g.types.map(([l, t]) => [t, l])));
const TYPE_BY_LABEL = new Map(RESOURCE_GROUPS.flatMap((g) => g.types.map(([l, t]) => [l, t])));

/** The Resource menu's groups. */
export const RESOURCE_MENU: readonly FilterSelectGroup[] = RESOURCE_GROUPS.map((g) => ({
  label: g.label,
  options: g.types.map(([label]) => label),
}));

/** Whether the type has a place in the Resource menu. */
export function isListedResource(type: string): boolean {
  return LABEL_BY_TYPE.has(type);
}

/** The menu entry's type, or `undefined` for a label the menu doesn't list. */
export function resourceTypeOf(label: string): string | undefined {
  return TYPE_BY_LABEL.get(label);
}

/**
 * How a resource type reads: its menu label, or for a request row the view's
 * name as words — `PlatformHospitalDetailView` → "Platform hospital detail
 * requests".
 */
export function resourceName(type: string): string {
  const listed = LABEL_BY_TYPE.get(type);
  if (listed) return listed;
  const words = type
    .replace(/View$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .trim()
    .toLowerCase();
  if (!words) return type;
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return type.endsWith('View') ? `${sentence} requests` : sentence;
}
