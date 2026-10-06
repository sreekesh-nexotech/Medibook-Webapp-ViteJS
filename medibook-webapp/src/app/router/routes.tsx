import { createBrowserRouter, Navigate } from 'react-router-dom';

import { NotFoundScreen } from '@/app/layouts/NotFoundScreen';
import { DashboardSwitch } from '@/app/router/DashboardSwitch';
import { HospitalGuard } from '@/app/router/HospitalGuard';
import { OpsGuard } from '@/app/router/OpsGuard';
import { ReportDownloadGuard } from '@/app/router/ReportDownloadGuard';
import {
  AUTH_FORGOT_PATH,
  AUTH_INVITE_PATH,
  AUTH_LOGIN_PATH,
  AUTH_RESET_PATH,
  HOSPITAL_VIEW_SEGMENT,
  OPS_BASE_PATH,
  OPS_REPORT_DOWNLOAD_PATH,
  OPS_RESET_PATH,
  OPS_VIEW_SEGMENT,
  REPORT_DOWNLOAD_PATH,
  ROOT_PATH,
} from '@/app/router/paths';
import { RequireAdmin } from '@/app/router/RequireAdmin';
import { RootRedirect } from '@/app/router/RootRedirect';
import {
  AppointmentsScreen,
  AuditTrailScreen,
  CreateAppointmentScreen,
  DoctorDetailPageScreen,
  DoctorsDepartmentsScreen,
  HelpSupportScreen,
  HospitalProfileScreen,
  HospitalSettingsScreen,
  MessagingScreen,
  MyAccountScreen,
  OpsAnalyticsScreen,
  OpsBillingScreen,
  OpsComplianceScreen,
  OpsDashboardScreen,
  OpsHospitalDetailScreen,
  OpsHospitalsScreen,
  OpsInvoiceDetailScreen,
  OpsLogsScreen,
  OpsNotificationsScreen,
  OpsOnboardingScreen,
  OpsPaymentDetailScreen,
  OpsPlansScreen,
  OpsPlatformUserDetailScreen,
  OpsPlatformUsersScreen,
  OpsReportsScreen,
  OpsSettingsScreen,
  OpsSettlementsScreen,
  OpsUsersScreen,
  PatientDetailScreen,
  PatientsScreen,
  PaymentsScreen,
  ReportsScreen,
  ServicesPricingScreen,
  SettlementsScreen,
  SlotsScreen,
  TokenCountersScreen,
  UsersRolesScreen,
} from '@/app/router/lazyScreens';

import { AcceptInvitationScreen } from '@/features/auth/presentation/screens/AcceptInvitationScreen';
import { ForgotPasswordScreen } from '@/features/auth/presentation/screens/ForgotPasswordScreen';
import { LoginScreen } from '@/features/auth/presentation/screens/LoginScreen';
import { ResetPasswordScreen } from '@/features/auth/presentation/screens/ResetPasswordScreen';

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
  // Emailed links (public; ranked above `/:role` and `/ops/*` as static paths).
  { path: AUTH_RESET_PATH, element: <ResetPasswordScreen surface="hospital" /> },
  { path: OPS_RESET_PATH, element: <ResetPasswordScreen surface="platform" /> },
  { path: AUTH_INVITE_PATH, element: <AcceptInvitationScreen /> },
  // Emailed report links — matched ahead of `/:role` and `/ops/*` (static segments rank first).
  { path: REPORT_DOWNLOAD_PATH, element: <ReportDownloadGuard surface="hospital" /> },
  { path: OPS_REPORT_DOWNLOAD_PATH, element: <ReportDownloadGuard surface="platform" /> },
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
      { path: HOSPITAL_VIEW_SEGMENT.account, element: <MyAccountScreen surface="hospital" /> },
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
      { path: OPS_VIEW_SEGMENT.account, element: <MyAccountScreen surface="platform" /> },
      { path: CATCH_ALL, element: <NotFoundScreen /> },
    ],
  },
  { path: CATCH_ALL, element: <NotFoundScreen /> },
]);
