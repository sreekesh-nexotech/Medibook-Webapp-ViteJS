import { lazy } from 'react';

/*
 * Feature screens load on demand (one chunk per screen), so the first paint
 * only downloads the shells, guards and auth screens. `HospitalShell` and
 * `OpsShell` wrap their outlet in `Suspense`.
 */
export const AuditTrailScreen = lazy(() =>
  import('@/features/audit/presentation/screens/AuditTrailScreen').then((m) => ({
    default: m.AuditTrailScreen,
  })),
);
export const AppointmentsScreen = lazy(() =>
  import('@/features/appointments/presentation/screens/AppointmentsScreen').then((m) => ({
    default: m.AppointmentsScreen,
  })),
);
export const CreateAppointmentScreen = lazy(() =>
  import('@/features/appointments/presentation/screens/CreateAppointmentScreen').then((m) => ({
    default: m.CreateAppointmentScreen,
  })),
);
export const DoctorDetailPageScreen = lazy(() =>
  import('@/features/doctors/presentation/screens/DoctorDetailPageScreen').then((m) => ({
    default: m.DoctorDetailPageScreen,
  })),
);
export const DoctorsDepartmentsScreen = lazy(() =>
  import('@/features/doctors/presentation/screens/DoctorsDepartmentsScreen').then((m) => ({
    default: m.DoctorsDepartmentsScreen,
  })),
);
export const HelpSupportScreen = lazy(() =>
  import('@/features/help/presentation/screens/HelpSupportScreen').then((m) => ({
    default: m.HelpSupportScreen,
  })),
);
export const MessagingScreen = lazy(() =>
  import('@/features/messaging/presentation/screens/MessagingScreen').then((m) => ({
    default: m.MessagingScreen,
  })),
);
export const OpsAnalyticsScreen = lazy(() =>
  import('@/features/ops-analytics/presentation/screens/OpsAnalyticsScreen').then((m) => ({
    default: m.OpsAnalyticsScreen,
  })),
);
export const OpsBillingScreen = lazy(() =>
  import('@/features/ops-billing/presentation/screens/OpsBillingScreen').then((m) => ({
    default: m.OpsBillingScreen,
  })),
);
export const OpsInvoiceDetailScreen = lazy(() =>
  import('@/features/ops-billing/presentation/screens/OpsInvoiceDetailScreen').then((m) => ({
    default: m.OpsInvoiceDetailScreen,
  })),
);
export const OpsPaymentDetailScreen = lazy(() =>
  import('@/features/ops-billing/presentation/screens/OpsPaymentDetailScreen').then((m) => ({
    default: m.OpsPaymentDetailScreen,
  })),
);
export const OpsComplianceScreen = lazy(() =>
  import('@/features/ops-compliance/presentation/screens/OpsComplianceScreen').then((m) => ({
    default: m.OpsComplianceScreen,
  })),
);
export const OpsDashboardScreen = lazy(() =>
  import('@/features/ops-dashboard/presentation/screens/OpsDashboardScreen').then((m) => ({
    default: m.OpsDashboardScreen,
  })),
);
export const OpsHospitalDetailScreen = lazy(() =>
  import('@/features/ops-hospitals/presentation/screens/OpsHospitalDetailScreen').then((m) => ({
    default: m.OpsHospitalDetailScreen,
  })),
);
export const OpsHospitalsScreen = lazy(() =>
  import('@/features/ops-hospitals/presentation/screens/OpsHospitalsScreen').then((m) => ({
    default: m.OpsHospitalsScreen,
  })),
);
export const OpsOnboardingScreen = lazy(() =>
  import('@/features/ops-hospitals/presentation/screens/OpsOnboardingScreen').then((m) => ({
    default: m.OpsOnboardingScreen,
  })),
);
export const OpsLogsScreen = lazy(() =>
  import('@/features/ops-logs/presentation/screens/OpsLogsScreen').then((m) => ({
    default: m.OpsLogsScreen,
  })),
);
export const OpsNotificationsScreen = lazy(() =>
  import('@/features/ops-notifications/presentation/screens/OpsNotificationsScreen').then((m) => ({
    default: m.OpsNotificationsScreen,
  })),
);
export const OpsPlansScreen = lazy(() =>
  import('@/features/ops-plans/presentation/screens/OpsPlansScreen').then((m) => ({
    default: m.OpsPlansScreen,
  })),
);
export const OpsPlatformUserDetailScreen = lazy(() =>
  import('@/features/ops-platform-users/presentation/screens/OpsPlatformUserDetailScreen').then(
    (m) => ({ default: m.OpsPlatformUserDetailScreen }),
  ),
);
export const OpsPlatformUsersScreen = lazy(() =>
  import('@/features/ops-platform-users/presentation/screens/OpsPlatformUsersScreen').then((m) => ({
    default: m.OpsPlatformUsersScreen,
  })),
);
export const OpsReportsScreen = lazy(() =>
  import('@/features/ops-reports/presentation/screens/OpsReportsScreen').then((m) => ({
    default: m.OpsReportsScreen,
  })),
);
export const OpsSettingsScreen = lazy(() =>
  import('@/features/ops-settings/presentation/screens/OpsSettingsScreen').then((m) => ({
    default: m.OpsSettingsScreen,
  })),
);
export const OpsSettlementsScreen = lazy(() =>
  import('@/features/ops-settlements/presentation/screens/OpsSettlementsScreen').then((m) => ({
    default: m.OpsSettlementsScreen,
  })),
);
export const OpsUsersScreen = lazy(() =>
  import('@/features/ops-users/presentation/screens/OpsUsersScreen').then((m) => ({
    default: m.OpsUsersScreen,
  })),
);
export const PatientDetailScreen = lazy(() =>
  import('@/features/patients/presentation/screens/PatientDetailScreen').then((m) => ({
    default: m.PatientDetailScreen,
  })),
);
export const PatientsScreen = lazy(() =>
  import('@/features/patients/presentation/screens/PatientsScreen').then((m) => ({
    default: m.PatientsScreen,
  })),
);
export const MyAccountScreen = lazy(() =>
  import('@/features/profile/presentation/screens/MyAccountScreen').then((m) => ({
    default: m.MyAccountScreen,
  })),
);
export const PaymentsScreen = lazy(() =>
  import('@/features/payments/presentation/screens/PaymentsScreen').then((m) => ({
    default: m.PaymentsScreen,
  })),
);
export const ReportsScreen = lazy(() =>
  import('@/features/reports/presentation/screens/ReportsScreen').then((m) => ({
    default: m.ReportsScreen,
  })),
);
export const ReportDownloadScreen = lazy(() =>
  import('@/features/reports/presentation/screens/ReportDownloadScreen').then((m) => ({
    default: m.ReportDownloadScreen,
  })),
);
export const HospitalProfileScreen = lazy(() =>
  import('@/features/settings/presentation/screens/HospitalProfileScreen').then((m) => ({
    default: m.HospitalProfileScreen,
  })),
);
export const HospitalSettingsScreen = lazy(() =>
  import('@/features/settings/presentation/screens/HospitalSettingsScreen').then((m) => ({
    default: m.HospitalSettingsScreen,
  })),
);
export const ServicesPricingScreen = lazy(() =>
  import('@/features/settings/presentation/screens/ServicesPricingScreen').then((m) => ({
    default: m.ServicesPricingScreen,
  })),
);
export const SlotsScreen = lazy(() =>
  import('@/features/slots/presentation/screens/SlotsScreen').then((m) => ({
    default: m.SlotsScreen,
  })),
);
export const SettlementsScreen = lazy(() =>
  import('@/features/settlements/presentation/screens/SettlementsScreen').then((m) => ({
    default: m.SettlementsScreen,
  })),
);
export const TokenCountersScreen = lazy(() =>
  import('@/features/token-queue/presentation/screens/TokenCountersScreen').then((m) => ({
    default: m.TokenCountersScreen,
  })),
);
export const UsersRolesScreen = lazy(() =>
  import('@/features/users-roles/presentation/screens/UsersRolesScreen').then((m) => ({
    default: m.UsersRolesScreen,
  })),
);
