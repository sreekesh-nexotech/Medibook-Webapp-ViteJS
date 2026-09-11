import { createBrowserRouter, Navigate } from 'react-router-dom';

import { NotFoundScreen } from '@/app/layouts/NotFoundScreen';
import { DashboardSwitch } from '@/app/router/DashboardSwitch';
import { HospitalGuard } from '@/app/router/HospitalGuard';
import { OpsGuard } from '@/app/router/OpsGuard';
import {
  AUTH_FORGOT_PATH,
  AUTH_LOGIN_PATH,
  HOSPITAL_VIEW_SEGMENT,
  OPS_BASE_PATH,
  OPS_VIEW_SEGMENT,
  ROOT_PATH,
} from '@/app/router/paths';
import { RequireAdmin } from '@/app/router/RequireAdmin';
import { RootRedirect } from '@/app/router/RootRedirect';

import { AppointmentsScreen } from '@/features/appointments/presentation/screens/AppointmentsScreen';
import { CreateAppointmentScreen } from '@/features/appointments/presentation/screens/CreateAppointmentScreen';
import { ForgotPasswordScreen } from '@/features/auth/presentation/screens/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/presentation/screens/LoginScreen';
import { DoctorDetailPageScreen } from '@/features/doctors/presentation/screens/DoctorDetailPageScreen';
import { DoctorsDepartmentsScreen } from '@/features/doctors/presentation/screens/DoctorsDepartmentsScreen';
import { HelpSupportScreen } from '@/features/help/presentation/screens/HelpSupportScreen';
import { OpsAnalyticsScreen } from '@/features/ops-analytics/presentation/screens/OpsAnalyticsScreen';
import { OpsBillingScreen } from '@/features/ops-billing/presentation/screens/OpsBillingScreen';
import { OpsInvoiceDetailScreen } from '@/features/ops-billing/presentation/screens/OpsInvoiceDetailScreen';
import { OpsPaymentDetailScreen } from '@/features/ops-billing/presentation/screens/OpsPaymentDetailScreen';
import { OpsDashboardScreen } from '@/features/ops-dashboard/presentation/screens/OpsDashboardScreen';
import { OpsHospitalDetailScreen } from '@/features/ops-hospitals/presentation/screens/OpsHospitalDetailScreen';
import { OpsHospitalsScreen } from '@/features/ops-hospitals/presentation/screens/OpsHospitalsScreen';
import { OpsLogsScreen } from '@/features/ops-logs/presentation/screens/OpsLogsScreen';
import { OpsNotificationsScreen } from '@/features/ops-notifications/presentation/screens/OpsNotificationsScreen';
import { OpsPlansScreen } from '@/features/ops-plans/presentation/screens/OpsPlansScreen';
import { OpsPlatformUserDetailScreen } from '@/features/ops-platform-users/presentation/screens/OpsPlatformUserDetailScreen';
import { OpsPlatformUsersScreen } from '@/features/ops-platform-users/presentation/screens/OpsPlatformUsersScreen';
import { OpsReportsScreen } from '@/features/ops-reports/presentation/screens/OpsReportsScreen';
import { OpsSettingsScreen } from '@/features/ops-settings/presentation/screens/OpsSettingsScreen';
import { OpsSettlementsScreen } from '@/features/ops-settlements/presentation/screens/OpsSettlementsScreen';
import { OpsUsersScreen } from '@/features/ops-users/presentation/screens/OpsUsersScreen';
import { PatientDetailScreen } from '@/features/patients/presentation/screens/PatientDetailScreen';
import { PatientsScreen } from '@/features/patients/presentation/screens/PatientsScreen';
import { PaymentsScreen } from '@/features/payments/presentation/screens/PaymentsScreen';
import { ReportsScreen } from '@/features/reports/presentation/screens/ReportsScreen';
import { HospitalSettingsScreen } from '@/features/settings/presentation/screens/HospitalSettingsScreen';
import { SettlementsScreen } from '@/features/settlements/presentation/screens/SettlementsScreen';
import { TokenCountersScreen } from '@/features/token-queue/presentation/screens/TokenCountersScreen';
import { UsersRolesScreen } from '@/features/users-roles/presentation/screens/UsersRolesScreen';

/** React Router catch-all segment. */
const CATCH_ALL = '*';

/* ============================================================================
 * ORCHESTRATOR: screens to wire once the feature agents land
 * ============================================================================
 * The view ids, URL segments, `*Path()` helpers and sidebar nav entries for
 * every screen below already exist (`app/router/paths.ts`,
 * `app/layouts/hospital-nav.ts`, `app/layouts/ops-nav.ts`), so links and
 * `hospitalPath()` / `opsPath()` calls compile today. Only the route rows are
 * missing — deliberately, because importing a screen that does not exist yet
 * would break the build. Until each row lands the URL falls through to
 * `NotFoundScreen`, which explains itself instead of silently redirecting.
 *
 * HOSPITAL — every one of these is ADMIN-ONLY: add the row inside the existing
 * `{ element: <RequireAdmin />, children: [...] }` block, not beside it.
 *
 *   // ORCHESTRATOR: wire SlotsScreen here
 *   { path: HOSPITAL_VIEW_SEGMENT.slots, element: <SlotsScreen /> }
 *       url: /:role/slots        (admin only)
 *
 *   // ORCHESTRATOR: wire HospitalProfileScreen here
 *   { path: HOSPITAL_VIEW_SEGMENT.profile, element: <HospitalProfileScreen /> }
 *       url: /:role/profile      (admin only) — branches, holidays, banners
 *
 *   // ORCHESTRATOR: wire ServicesPricingScreen here
 *   { path: HOSPITAL_VIEW_SEGMENT.services, element: <ServicesPricingScreen /> }
 *       url: /:role/services     (admin only) — services & pricing, taxes, coupons
 *
 *   // ORCHESTRATOR: wire MessagingScreen here
 *   { path: HOSPITAL_VIEW_SEGMENT.messaging, element: <MessagingScreen /> }
 *       url: /:role/messaging    (admin only) — templates + announcements
 *
 *   // ORCHESTRATOR: wire AuditTrailScreen here
 *   { path: HOSPITAL_VIEW_SEGMENT.audit, element: <AuditTrailScreen /> }
 *       url: /:role/audit        (admin only)
 *
 *   // ORCHESTRATOR: wire PlanBillingScreen here — OPTIONAL
 *   { path: HOSPITAL_VIEW_SEGMENT.billing, element: <PlanBillingScreen /> }
 *       url: /:role/billing      (admin only)
 *       NOTE: plan & billing is ALREADY reachable — `PlanBilling` renders as a
 *       tab inside `SettlementsScreen`. The view id + segment + helper exist so
 *       it *can* be split out, but no sidebar entry was added and this row is
 *       only needed if the owning agent promotes it to its own screen.
 *
 * OPS — no role gate; the whole console is already behind `OpsGuard`.
 *
 *   // ORCHESTRATOR: wire OpsOnboardingScreen here
 *   { path: OPS_VIEW_SEGMENT.onboarding, element: <OpsOnboardingScreen /> }
 *       url: /ops/onboarding
 *
 *   // ORCHESTRATOR: wire OpsComplianceScreen here
 *   { path: OPS_VIEW_SEGMENT.compliance, element: <OpsComplianceScreen /> }
 *       url: /ops/compliance
 * ========================================================================== */

/** The full route tree (spec §6). Guards live beside it in `app/router/`. */
export const router = createBrowserRouter([
  { path: ROOT_PATH, element: <RootRedirect /> },
  { path: AUTH_LOGIN_PATH, element: <LoginScreen /> },
  { path: AUTH_FORGOT_PATH, element: <ForgotPasswordScreen /> },
  {
    path: '/:role',
    element: <HospitalGuard />,
    children: [
      { index: true, element: <Navigate to={HOSPITAL_VIEW_SEGMENT.dashboard} replace /> },
      { path: HOSPITAL_VIEW_SEGMENT.dashboard, element: <DashboardSwitch /> },
      { path: HOSPITAL_VIEW_SEGMENT.appointments, element: <AppointmentsScreen /> },
      { path: HOSPITAL_VIEW_SEGMENT.create, element: <CreateAppointmentScreen /> },
      { path: HOSPITAL_VIEW_SEGMENT.patients, element: <PatientsScreen /> },
      { path: HOSPITAL_VIEW_SEGMENT['patient-detail'], element: <PatientDetailScreen /> },
      { path: HOSPITAL_VIEW_SEGMENT.token, element: <TokenCountersScreen /> },
      { path: HOSPITAL_VIEW_SEGMENT.payments, element: <PaymentsScreen /> },
      { path: HOSPITAL_VIEW_SEGMENT.help, element: <HelpSupportScreen /> },
      {
        element: <RequireAdmin />,
        children: [
          { path: HOSPITAL_VIEW_SEGMENT.settlements, element: <SettlementsScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.doctors, element: <DoctorsDepartmentsScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT['doctor-detail'], element: <DoctorDetailPageScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.users, element: <UsersRolesScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.reports, element: <ReportsScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.settings, element: <HospitalSettingsScreen /> },
        ],
      },
      // Audit 3.2.4/3.7 — an unknown hospital URL explains itself instead of
      // silently redirecting to the dashboard.
      { path: CATCH_ALL, element: <NotFoundScreen /> },
    ],
  },
  {
    path: OPS_BASE_PATH,
    element: <OpsGuard />,
    children: [
      { index: true, element: <Navigate to={OPS_VIEW_SEGMENT.dashboard} replace /> },
      { path: OPS_VIEW_SEGMENT.dashboard, element: <OpsDashboardScreen /> },
      { path: OPS_VIEW_SEGMENT.hospitals, element: <OpsHospitalsScreen /> },
      { path: OPS_VIEW_SEGMENT['hospital-detail'], element: <OpsHospitalDetailScreen /> },
      { path: OPS_VIEW_SEGMENT.plans, element: <OpsPlansScreen /> },
      { path: OPS_VIEW_SEGMENT.billing, element: <OpsBillingScreen /> },
      { path: OPS_VIEW_SEGMENT['invoice-detail'], element: <OpsInvoiceDetailScreen /> },
      { path: OPS_VIEW_SEGMENT['payment-detail'], element: <OpsPaymentDetailScreen /> },
      { path: OPS_VIEW_SEGMENT.settlements, element: <OpsSettlementsScreen /> },
      { path: OPS_VIEW_SEGMENT.analytics, element: <OpsAnalyticsScreen /> },
      { path: OPS_VIEW_SEGMENT.reports, element: <OpsReportsScreen /> },
      { path: OPS_VIEW_SEGMENT.logs, element: <OpsLogsScreen /> },
      { path: OPS_VIEW_SEGMENT.users, element: <OpsUsersScreen /> },
      { path: OPS_VIEW_SEGMENT['platform-users'], element: <OpsPlatformUsersScreen /> },
      {
        path: OPS_VIEW_SEGMENT['platform-user-detail'],
        element: <OpsPlatformUserDetailScreen />,
      },
      { path: OPS_VIEW_SEGMENT.notifications, element: <OpsNotificationsScreen /> },
      { path: OPS_VIEW_SEGMENT.settings, element: <OpsSettingsScreen /> },
      { path: CATCH_ALL, element: <NotFoundScreen /> },
    ],
  },
  { path: CATCH_ALL, element: <NotFoundScreen /> },
]);
