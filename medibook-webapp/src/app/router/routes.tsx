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

import { AuditTrailScreen } from '@/features/audit/presentation/screens/AuditTrailScreen';
import { AppointmentsScreen } from '@/features/appointments/presentation/screens/AppointmentsScreen';
import { CreateAppointmentScreen } from '@/features/appointments/presentation/screens/CreateAppointmentScreen';
import { ForgotPasswordScreen } from '@/features/auth/presentation/screens/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/presentation/screens/LoginScreen';
import { DoctorDetailPageScreen } from '@/features/doctors/presentation/screens/DoctorDetailPageScreen';
import { DoctorsDepartmentsScreen } from '@/features/doctors/presentation/screens/DoctorsDepartmentsScreen';
import { HelpSupportScreen } from '@/features/help/presentation/screens/HelpSupportScreen';
import { MessagingScreen } from '@/features/messaging/presentation/screens/MessagingScreen';
import { OpsAnalyticsScreen } from '@/features/ops-analytics/presentation/screens/OpsAnalyticsScreen';
import { OpsBillingScreen } from '@/features/ops-billing/presentation/screens/OpsBillingScreen';
import { OpsInvoiceDetailScreen } from '@/features/ops-billing/presentation/screens/OpsInvoiceDetailScreen';
import { OpsPaymentDetailScreen } from '@/features/ops-billing/presentation/screens/OpsPaymentDetailScreen';
import { OpsComplianceScreen } from '@/features/ops-compliance/presentation/screens/OpsComplianceScreen';
import { OpsDashboardScreen } from '@/features/ops-dashboard/presentation/screens/OpsDashboardScreen';
import { OpsHospitalDetailScreen } from '@/features/ops-hospitals/presentation/screens/OpsHospitalDetailScreen';
import { OpsHospitalsScreen } from '@/features/ops-hospitals/presentation/screens/OpsHospitalsScreen';
import { OpsOnboardingScreen } from '@/features/ops-hospitals/presentation/screens/OpsOnboardingScreen';
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
import { HospitalProfileScreen } from '@/features/settings/presentation/screens/HospitalProfileScreen';
import { HospitalSettingsScreen } from '@/features/settings/presentation/screens/HospitalSettingsScreen';
import { ServicesPricingScreen } from '@/features/settings/presentation/screens/ServicesPricingScreen';
import { SlotsScreen } from '@/features/slots/presentation/screens/SlotsScreen';
import { SettlementsScreen } from '@/features/settlements/presentation/screens/SettlementsScreen';
import { TokenCountersScreen } from '@/features/token-queue/presentation/screens/TokenCountersScreen';
import { UsersRolesScreen } from '@/features/users-roles/presentation/screens/UsersRolesScreen';

/** React Router catch-all segment. */
const CATCH_ALL = '*';

/* ============================================================================
 * Every screen built this round is wired below.
 * ============================================================================
 * Hospital, all admin-only and inside `RequireAdmin`: slots, profile,
 * services, messaging, audit. Ops: onboarding and compliance.
 *
 * Deliberately NOT wired: `HOSPITAL_VIEW_SEGMENT.billing`. Plan & billing is
 * already reachable as a tab inside `SettlementsScreen`, so a second route and
 * nav entry would duplicate an existing screen. The view id, segment and
 * `hospitalBillingPath()` helper exist should it ever be promoted.
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
          // Added this round. All admin-only, so they belong inside this block
          // (`ADMIN_ONLY_HOSPITAL_VIEWS` in `paths.ts` is the single list).
          { path: HOSPITAL_VIEW_SEGMENT.slots, element: <SlotsScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.profile, element: <HospitalProfileScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.services, element: <ServicesPricingScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.messaging, element: <MessagingScreen /> },
          { path: HOSPITAL_VIEW_SEGMENT.audit, element: <AuditTrailScreen /> },
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
      { path: OPS_VIEW_SEGMENT.onboarding, element: <OpsOnboardingScreen /> },
      { path: OPS_VIEW_SEGMENT['hospital-detail'], element: <OpsHospitalDetailScreen /> },
      { path: OPS_VIEW_SEGMENT.plans, element: <OpsPlansScreen /> },
      { path: OPS_VIEW_SEGMENT.billing, element: <OpsBillingScreen /> },
      { path: OPS_VIEW_SEGMENT['invoice-detail'], element: <OpsInvoiceDetailScreen /> },
      { path: OPS_VIEW_SEGMENT['payment-detail'], element: <OpsPaymentDetailScreen /> },
      { path: OPS_VIEW_SEGMENT.settlements, element: <OpsSettlementsScreen /> },
      { path: OPS_VIEW_SEGMENT.analytics, element: <OpsAnalyticsScreen /> },
      { path: OPS_VIEW_SEGMENT.reports, element: <OpsReportsScreen /> },
      { path: OPS_VIEW_SEGMENT.logs, element: <OpsLogsScreen /> },
      { path: OPS_VIEW_SEGMENT.compliance, element: <OpsComplianceScreen /> },
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
