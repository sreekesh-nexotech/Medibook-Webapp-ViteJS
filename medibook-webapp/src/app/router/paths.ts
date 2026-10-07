/**
 * Route constants + view-id ↔ URL translation for both shells.
 *
 * The design prototype routed on hash "view ids" (`#<role>/<view>`,
 * `Medibook mbAdmin.html` `parseHash`). The port keeps those view ids —
 * titles, nav-active state, the history-aware back stack and allowed-view
 * checks all speak view ids — and this module is the single place they are
 * mapped to real URLs. No magic path strings anywhere else.
 */

import type { ApiSurface } from '@/core/api/surface';

/* ---------------------------------------------------------------- roles */

/** The two hospital roles the URL's `:role` segment may carry (design `ROLES`). */
export const HOSPITAL_ROLES = ['receptionist', 'admin'] as const;

export type HospitalRole = (typeof HOSPITAL_ROLES)[number];

export function isHospitalRole(value: string | null | undefined): value is HospitalRole {
  return value === 'receptionist' || value === 'admin';
}

/* ------------------------------------------------------ absolute anchors */

export const ROOT_PATH = '/';
export const AUTH_LOGIN_PATH = '/auth/login';
export const AUTH_FORGOT_PATH = '/auth/forgot';
export const OPS_BASE_PATH = '/ops';

/*
 * Public pages opened from emailed links. The backend builds these URLs as
 * `{FRONTEND_HOSPITAL_URL}/reset-password?token=…`,
 * `{FRONTEND_PLATFORM_URL}/reset-password?token=…` and
 * `{FRONTEND_HOSPITAL_URL}/accept-invite?token=…` (`messaging/services/context.py`),
 * so with one app serving both surfaces `FRONTEND_PLATFORM_URL` must be set
 * to `<app origin>/ops`.
 */
export const AUTH_RESET_PATH = '/reset-password';
export const OPS_RESET_PATH = `${OPS_BASE_PATH}/reset-password`;
export const AUTH_INVITE_PATH = '/accept-invite';

/** Query param carrying an emailed token (reset or invitation). */
export const AUTH_TOKEN_PARAM = 'token';

/** Query param telling the forgot-password screen which surface to email from. */
export const AUTH_SURFACE_PARAM = 'surface';

/** `AUTH_SURFACE_PARAM` value for the operations console. */
export const AUTH_SURFACE_OPS = 'ops';

/*
 * Emailed report links. A large export or a scheduled report is emailed as
 * `{FRONTEND_HOSPITAL_URL}/reports/downloads/{file_id}` or
 * `{FRONTEND_PLATFORM_URL}/reports/downloads/{file_id}`
 * (`messaging/services/context.py`). Signed file links live 10 minutes, so the
 * page mints one after sign-in instead of the email carrying it.
 */
export const REPORT_DOWNLOAD_PATH = '/reports/downloads/:fileId';
export const OPS_REPORT_DOWNLOAD_PATH = `${OPS_BASE_PATH}${REPORT_DOWNLOAD_PATH}`;

/** Query param carrying the emailed link to reopen after sign-in. */
export const AUTH_NEXT_PARAM = 'next';

/** An emailed report link on either surface: `[/ops]/reports/downloads/<uuid>`. */
const REPORT_DOWNLOAD_PATTERN =
  /^(\/ops)?\/reports\/downloads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sign-in that returns to `path` (an emailed report link) afterwards. */
export function loginReturningTo(path: string): string {
  return `${AUTH_LOGIN_PATH}?${new URLSearchParams({ [AUTH_NEXT_PARAM]: path }).toString()}`;
}

/** Whether `next` is an emailed link into the operations console. */
export function isOpsReturnPath(next: string | null): boolean {
  return next !== null && REPORT_DOWNLOAD_PATTERN.test(next) && next.startsWith(OPS_BASE_PATH);
}

/**
 * Where sign-in returns to, or `null` for the dashboard. Only an emailed
 * report link on the surface just signed in to is accepted, so the param can
 * never send anyone off-site or into the other console.
 */
export function returnPathAfterLogin(next: string | null, surface: ApiSurface): string | null {
  if (next === null || !REPORT_DOWNLOAD_PATTERN.test(next)) return null;
  return isOpsReturnPath(next) === (surface === 'platform') ? next : null;
}

/* ------------------------------------------------------- hospital views */

/**
 * Hospital view ids, exactly as the design prototype named them, plus the
 * screens the current build round adds (`slots` … `billing`). A view id lives
 * here before its screen exists so nav entries, links and `hospitalPath()`
 * calls compile while the screen is being built; until the route is wired the
 * URL falls through to `NotFoundScreen`, which says so rather than silently
 * bouncing to the dashboard.
 */
export type HospitalView =
  | 'dashboard'
  | 'appointments'
  | 'create'
  | 'patients'
  | 'patient-detail'
  | 'token'
  | 'payments'
  | 'settlements'
  | 'doctors'
  | 'doctor-detail'
  | 'users'
  | 'reports'
  | 'settings'
  | 'help'
  // ---- added this round (screens owned by the feature agents) ----
  /** Doctor slot templates + exceptions. Admin-only. */
  | 'slots'
  /** Hospital profile: branches, holidays, banners. Admin-only. */
  | 'profile'
  /** Services & pricing, taxes, coupons. Admin-only. */
  | 'services'
  /** Patient messaging templates + announcements. Admin-only. */
  | 'messaging'
  /** Hospital-side audit trail. Admin-only. */
  | 'audit'
  /** Plan & billing (today a tab inside `settlements`). Admin-only. */
  | 'billing'
  /** The signed-in user's own account: name, password, sessions. Every role. */
  | 'account';

/** Detail views whose URL carries a param (`OpsSel`/`Store` selection → URL). */
export type HospitalDetailView = 'patient-detail' | 'doctor-detail';

/** Views navigable without a param (nav items, notification targets, "create"). */
export type HospitalStaticView = Exclude<HospitalView, HospitalDetailView>;

/** URL segment under `/:role` for every hospital view (detail views carry a param). */
export const HOSPITAL_VIEW_SEGMENT: Readonly<Record<HospitalView, string>> = {
  dashboard: 'dashboard',
  appointments: 'appointments',
  create: 'appointments/new',
  patients: 'patients',
  'patient-detail': 'patients/:patientId',
  token: 'token',
  payments: 'payments',
  settlements: 'settlements',
  doctors: 'doctors',
  'doctor-detail': 'doctors/:id',
  users: 'users',
  reports: 'reports',
  settings: 'settings',
  help: 'help',
  slots: 'slots',
  profile: 'profile',
  services: 'services',
  messaging: 'messaging',
  audit: 'audit',
  billing: 'billing',
  account: 'account',
};

/** Absolute path for a param-free hospital view. */
export function hospitalPath(role: HospitalRole, view: HospitalStaticView): string {
  return `/${role}/${HOSPITAL_VIEW_SEGMENT[view]}`;
}

/**
 * Query param carrying the patient's record id from the patients screens to New
 * Appointment. Patient URLs carry the record id, never the MRN, so MR numbers
 * stay out of browser history and server access logs (PHI-07).
 */
export const BOOK_FOR_PATIENT_PARAM = 'patient';

/** Query param carrying a department name from the front desk to Token Management. */
export const TOKEN_DEPT_PARAM = 'dept';

/** New Appointment, pre-selecting the patient with this record id. */
export function hospitalBookForPatientPath(role: HospitalRole, patientId: string): string {
  const query = new URLSearchParams({ [BOOK_FOR_PATIENT_PARAM]: patientId });
  return `${hospitalPath(role, 'create')}?${query}`;
}

/** One patient's page, by record id (never the MRN — see `BOOK_FOR_PATIENT_PARAM`). */
export function hospitalPatientPath(role: HospitalRole, patientId: string): string {
  const segment = HOSPITAL_VIEW_SEGMENT['patient-detail'].replace(
    ':patientId',
    encodeURIComponent(patientId),
  );
  return `/${role}/${segment}`;
}

/** Backend record ids are UUIDs; any other patient URL is an older MRN link. */
const RECORD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isRecordId(value: string): boolean {
  return RECORD_ID.test(value);
}

/** Token Management, filtered to one department. */
export function hospitalTokenForDeptPath(role: HospitalRole, dept: string): string {
  return `${hospitalPath(role, 'token')}?${new URLSearchParams({ [TOKEN_DEPT_PARAM]: dept })}`;
}

export function hospitalDashboardPath(role: HospitalRole): string {
  return hospitalPath(role, 'dashboard');
}

/* Named helpers for the views added this round, so feature screens link by
 * function rather than by assembling a path string. */

export function hospitalSlotsPath(role: HospitalRole): string {
  return hospitalPath(role, 'slots');
}

export function hospitalAccountPath(role: HospitalRole): string {
  return hospitalPath(role, 'account');
}

/** List views resolvable 1:1 from their first URL segment. */
const HOSPITAL_SEGMENT_VIEWS: readonly HospitalView[] = [
  'dashboard',
  'appointments',
  'patients',
  'token',
  'payments',
  'settlements',
  'doctors',
  'users',
  'reports',
  'settings',
  'help',
  'slots',
  'profile',
  'services',
  'messaging',
  'audit',
  'billing',
  'account',
];

/** Current hospital view id from a `/:role/...` pathname (design `parseHash`). */
export function hospitalViewFromPath(pathname: string): HospitalView {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[1];
  const second = segments[2];
  if (first === 'appointments' && second === 'new') return 'create';
  if (first === 'patients' && second) return 'patient-detail';
  if (first === 'doctors' && second) return 'doctor-detail';
  return HOSPITAL_SEGMENT_VIEWS.find((v) => v === first) ?? 'dashboard';
}

/* ------------------------------------------------------------ ops views */

/** Ops view ids, exactly as the design prototype named them (`OPS_VIEWS_SET`). */
export type OpsView =
  | 'dashboard'
  | 'hospitals'
  | 'hospital-detail'
  | 'plans'
  | 'billing'
  | 'invoice-detail'
  | 'payment-detail'
  | 'settlements'
  | 'analytics'
  | 'reports'
  | 'logs'
  | 'users'
  | 'platform-users'
  | 'platform-user-detail'
  | 'notifications'
  | 'settings'
  // ---- added this round (screens owned by the feature agents) ----
  /** Hospital onboarding pipeline (applications, KYC, go-live). */
  | 'onboarding'
  /** Document/regulatory compliance per hospital. */
  | 'compliance'
  /** The signed-in user's own account: name, password, sessions. */
  | 'account'
  /** Support tickets from hospitals and patients (OBS-02). */
  | 'support'
  | 'support-ticket';

/** Ops detail views whose URL carries a param (`OpsSel` selection → URL). */
export type OpsDetailView =
  | 'hospital-detail'
  | 'invoice-detail'
  | 'payment-detail'
  | 'platform-user-detail'
  | 'support-ticket';

/** Ops views navigable without a param (nav items, notification targets). */
export type OpsStaticView = Exclude<OpsView, OpsDetailView>;

/** URL segment under `/ops` for every ops view (detail views carry a param). */
export const OPS_VIEW_SEGMENT: Readonly<Record<OpsView, string>> = {
  dashboard: 'dashboard',
  hospitals: 'hospitals',
  'hospital-detail': 'hospitals/:id',
  plans: 'plans',
  billing: 'billing',
  'invoice-detail': 'billing/invoices/:id',
  'payment-detail': 'billing/payments/:id',
  settlements: 'settlements',
  analytics: 'analytics',
  reports: 'reports',
  logs: 'logs',
  users: 'users',
  'platform-users': 'platform-users',
  'platform-user-detail': 'platform-users/:id',
  notifications: 'notifications',
  settings: 'settings',
  onboarding: 'onboarding',
  compliance: 'compliance',
  account: 'account',
  support: 'support',
  'support-ticket': 'support/:id',
};

/** Absolute path for a param-free ops view. */
export function opsPath(view: OpsStaticView): string {
  return `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT[view]}`;
}

/** Absolute path for one hospital's ops profile (bell/alert `hospital:<id>` targets). */
/** One subscription invoice in the ops billing screen. */
export function opsInvoiceDetailPath(id: string): string {
  return `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['invoice-detail'].replace(':id', encodeURIComponent(id))}`;
}

/** One subscription payment in the ops billing screen. */
export function opsPaymentDetailPath(id: string): string {
  return `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['payment-detail'].replace(':id', encodeURIComponent(id))}`;
}

/** One patient account in the ops console. */
export function opsPlatformUserDetailPath(id: string): string {
  return `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT['platform-users']}/${encodeURIComponent(id)}`;
}

/** One support ticket in the ops inbox. */
export function opsSupportTicketPath(id: string): string {
  return `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT.support}/${encodeURIComponent(id)}`;
}

export function opsHospitalDetailPath(id: string): string {
  return `${OPS_BASE_PATH}/${OPS_VIEW_SEGMENT.hospitals}/${encodeURIComponent(id)}`;
}

/* Named helpers for the ops views added this round. */

export function opsOnboardingPath(): string {
  return opsPath('onboarding');
}

export function opsAccountPath(): string {
  return opsPath('account');
}

/** Ops list views resolvable 1:1 from their first URL segment. */
const OPS_SEGMENT_VIEWS: readonly OpsView[] = [
  'dashboard',
  'hospitals',
  'plans',
  'billing',
  'settlements',
  'analytics',
  'reports',
  'logs',
  'users',
  'platform-users',
  'notifications',
  'settings',
  'onboarding',
  'compliance',
  'account',
  'support',
];

/** Current ops view id from an `/ops/...` pathname. */
export function opsViewFromPath(pathname: string): OpsView {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[1];
  const second = segments[2];
  const third = segments[3];
  if (first === 'hospitals' && second) return 'hospital-detail';
  if (first === 'billing' && second === 'invoices' && third) return 'invoice-detail';
  if (first === 'billing' && second === 'payments' && third) return 'payment-detail';
  if (first === 'platform-users' && second) return 'platform-user-detail';
  if (first === 'support' && second) return 'support-ticket';
  return OPS_SEGMENT_VIEWS.find((v) => v === first) ?? 'dashboard';
}
