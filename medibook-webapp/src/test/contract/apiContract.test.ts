import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';

import { appConfigResponseSchema } from '@/core/api/appConfig.response';
import { signedUrlResponseSchema, storedFileResponseSchema } from '@/core/api/files.response';
import {
  appointmentPageSchema,
  eventPageSchema,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.api';
import {
  appointmentResponseSchema,
  receiptResponseSchema,
  tokenSlipResponseSchema,
} from '@/features/appointments/infrastructure/data-sources/remote/appointments.response';
import { auditLogPageResponseSchema } from '@/features/audit/infrastructure/data-sources/remote/audit.response';
import {
  hospitalMeResponseSchema,
  platformMeResponseSchema,
} from '@/features/auth/infrastructure/data-sources/remote/auth.response';
import {
  adminDashboardResponseSchema,
  receptionDashboardResponseSchema,
} from '@/features/dashboard/infrastructure/data-sources/remote/dashboard.response';
import {
  departmentPageSchema,
  doctorPageSchema,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.api';
import {
  doctorResponseSchema,
  scheduleResponseSchema,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';
import {
  deliveryPageResponseSchema,
  templatePageResponseSchema,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.response';
import {
  apiErrorsResponseSchema,
  bookingsByMonthResponseSchema,
  departmentsSplitResponseSchema,
  overviewResponseSchema,
  providersResponseSchema,
  topHospitalsResponseSchema,
} from '@/features/ops-analytics/infrastructure/data-sources/remote/analytics.response';
import {
  dunningPageSchema,
  invoiceDetailSchema,
  invoicePageSchema,
  paymentPageSchema,
  planChangePageSchema,
  subscriptionSchema,
} from '@/features/ops-billing/infrastructure/data-sources/remote/billing.response';
import {
  configChangePageSchema,
  dataRequestPageSchema,
  loginEventPageSchema,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.response';
import { opsDashboardResponseSchema } from '@/features/ops-dashboard/infrastructure/data-sources/remote/opsDashboard.response';
import {
  hospitalDetailResponseSchema,
  hospitalPageResponseSchema,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.response';
import {
  caseDetailResponseSchema,
  caseListResponseSchema,
  requirementPageResponseSchema,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/onboarding.response';
import { logsPageResponseSchema } from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';
import { bannersPageResponseSchema } from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.response';
import {
  planPageResponseSchema,
  subscriberPageResponseSchema,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';
import {
  platformUserDetailResponseSchema,
  platformUsersPageResponseSchema,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';
import { reportListResponseSchema } from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';
import {
  featureFlagPageResponseSchema,
  platformSettingsResponseSchema,
  taxRatePageResponseSchema,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.response';
import {
  payoutRunDetailResponseSchema,
  payoutRunPageResponseSchema,
  periodPageResponseSchema,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.response';
import {
  rolePageResponseSchema as opsUsersRolePageResponseSchema,
  staffPageResponseSchema as opsUsersStaffPageResponseSchema,
  permissionsResponseSchema,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.response';
import {
  ticketDetailResponseSchema,
  ticketPageResponseSchema,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.response';
import {
  hospitalPatientPageResponseSchema,
  hospitalPatientResponseSchema,
  patientAppointmentPageResponseSchema,
} from '@/features/patients/infrastructure/data-sources/remote/patients.response';
import {
  cashSessionPageResponseSchema,
  paymentDetailResponseSchema,
  paymentPageResponseSchema,
  visitReceiptPageResponseSchema,
} from '@/features/payments/infrastructure/data-sources/remote/payments.response';
import { activeSessionsPageResponseSchema } from '@/features/profile/infrastructure/data-sources/remote/profile.response';
import {
  reportCatalogResponseSchema,
  reportResultResponseSchema,
} from '@/features/reports/infrastructure/data-sources/remote/reports.response';
import {
  bannerPageResponseSchema,
  holidayPageResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/profile.response';
import {
  couponPageSchema,
  servicePageSchema,
  taxRatePageSchema,
} from '@/features/settings/infrastructure/data-sources/remote/services.api';
import {
  bankAccountPageResponseSchema,
  hospitalProfileResponseSchema,
  hospitalSettingsResponseSchema,
  scheduleHoursListResponseSchema,
  numberingListResponseSchema,
  tokenPolicyResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/settings.response';
import {
  billingPlanPageResponseSchema,
  invoiceDetailResponseSchema,
  invoicePageResponseSchema,
  planChangeRequestPageResponseSchema,
  subscriptionResponseSchema,
  usageResponseSchema,
} from '@/features/settlements/infrastructure/data-sources/remote/billing.response';
import {
  settlementPeriodDetailResponseSchema,
  settlementPeriodPageResponseSchema,
  statementPageResponseSchema,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.response';
import {
  generationRunPageResponseSchema,
  slotGridPageResponseSchema,
} from '@/features/slots/infrastructure/data-sources/remote/slots.response';
import { sessionPageSchema } from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.api';
import {
  invitationPageResponseSchema,
  rolePreviewResponseSchema,
  rolePageResponseSchema as usersRolesRolePageResponseSchema,
  staffPageResponseSchema as usersRolesStaffPageResponseSchema,
} from '@/features/users-roles/infrastructure/data-sources/remote/usersRoles.response';

/**
 * API contract tests (checklist REL-04). Each fixture is a real backend
 * response recorded by `scripts/record-api-fixtures.mjs`, scrubbed of
 * identifiers, and each must parse with the schema the app uses for it.
 * Re-record after a backend change; a failure here is a mismatch the app
 * would show as "The server sent an unexpected response".
 */
const CONTRACTS: Readonly<Record<string, ZodType>> = {
  'appointments.appointmentPageSchema': appointmentPageSchema,
  'appointments.appointmentResponseSchema': appointmentResponseSchema,
  'appointments.eventPageSchema': eventPageSchema,
  'appointments.receiptResponseSchema': receiptResponseSchema,
  'appointments.tokenSlipResponseSchema': tokenSlipResponseSchema,
  'audit.auditLogPageResponseSchema': auditLogPageResponseSchema,
  'auth.hospitalMeResponseSchema': hospitalMeResponseSchema,
  'auth.platformMeResponseSchema': platformMeResponseSchema,
  'core.appConfigResponseSchema': appConfigResponseSchema,
  'core.signedUrlResponseSchema': signedUrlResponseSchema,
  'core.storedFileResponseSchema': storedFileResponseSchema,
  'dashboard.adminDashboardResponseSchema': adminDashboardResponseSchema,
  'dashboard.receptionDashboardResponseSchema': receptionDashboardResponseSchema,
  'doctors.departmentPageSchema': departmentPageSchema,
  'doctors.doctorPageSchema': doctorPageSchema,
  'doctors.doctorResponseSchema': doctorResponseSchema,
  'doctors.scheduleResponseSchema': scheduleResponseSchema,
  'messaging.deliveryPageResponseSchema': deliveryPageResponseSchema,
  'messaging.templatePageResponseSchema': templatePageResponseSchema,
  'ops-analytics.apiErrorsResponseSchema': apiErrorsResponseSchema,
  'ops-analytics.bookingsByMonthResponseSchema': bookingsByMonthResponseSchema,
  'ops-analytics.departmentsSplitResponseSchema': departmentsSplitResponseSchema,
  'ops-analytics.overviewResponseSchema': overviewResponseSchema,
  'ops-analytics.providersResponseSchema': providersResponseSchema,
  'ops-analytics.topHospitalsResponseSchema': topHospitalsResponseSchema,
  'ops-billing.dunningPageSchema': dunningPageSchema,
  'ops-billing.invoiceDetailSchema': invoiceDetailSchema,
  'ops-billing.invoicePageSchema': invoicePageSchema,
  'ops-billing.paymentPageSchema': paymentPageSchema,
  'ops-billing.planChangePageSchema': planChangePageSchema,
  'ops-billing.subscriptionSchema': subscriptionSchema,
  'ops-compliance.configChangePageSchema': configChangePageSchema,
  'ops-compliance.dataRequestPageSchema': dataRequestPageSchema,
  'ops-compliance.loginEventPageSchema': loginEventPageSchema,
  'ops-dashboard.opsDashboardResponseSchema': opsDashboardResponseSchema,
  'ops-hospitals.caseDetailResponseSchema': caseDetailResponseSchema,
  'ops-hospitals.caseListResponseSchema': caseListResponseSchema,
  'ops-hospitals.hospitalDetailResponseSchema': hospitalDetailResponseSchema,
  'ops-hospitals.hospitalPageResponseSchema': hospitalPageResponseSchema,
  'ops-hospitals.requirementPageResponseSchema': requirementPageResponseSchema,
  'ops-logs.logsPageResponseSchema': logsPageResponseSchema,
  'ops-notifications.bannersPageResponseSchema': bannersPageResponseSchema,
  'ops-plans.planPageResponseSchema': planPageResponseSchema,
  'ops-plans.subscriberPageResponseSchema': subscriberPageResponseSchema,
  'ops-platform-users.platformUserDetailResponseSchema': platformUserDetailResponseSchema,
  'ops-platform-users.platformUsersPageResponseSchema': platformUsersPageResponseSchema,
  'ops-reports.reportListResponseSchema': reportListResponseSchema,
  'ops-settings.featureFlagPageResponseSchema': featureFlagPageResponseSchema,
  'ops-settings.platformSettingsResponseSchema': platformSettingsResponseSchema,
  'ops-settings.taxRatePageResponseSchema': taxRatePageResponseSchema,
  'ops-settlements.payoutRunDetailResponseSchema': payoutRunDetailResponseSchema,
  'ops-settlements.payoutRunPageResponseSchema': payoutRunPageResponseSchema,
  'ops-settlements.periodPageResponseSchema': periodPageResponseSchema,
  'ops-support.ticketDetailResponseSchema': ticketDetailResponseSchema,
  'ops-support.ticketPageResponseSchema': ticketPageResponseSchema,
  'ops-users.permissionsResponseSchema': permissionsResponseSchema,
  'ops-users.rolePageResponseSchema': opsUsersRolePageResponseSchema,
  'ops-users.staffPageResponseSchema': opsUsersStaffPageResponseSchema,
  'patients.hospitalPatientPageResponseSchema': hospitalPatientPageResponseSchema,
  'patients.hospitalPatientResponseSchema': hospitalPatientResponseSchema,
  'patients.patientAppointmentPageResponseSchema': patientAppointmentPageResponseSchema,
  'payments.cashSessionPageResponseSchema': cashSessionPageResponseSchema,
  'payments.paymentDetailResponseSchema': paymentDetailResponseSchema,
  'payments.paymentPageResponseSchema': paymentPageResponseSchema,
  'payments.visitReceiptPageResponseSchema': visitReceiptPageResponseSchema,
  'profile.activeSessionsPageResponseSchema': activeSessionsPageResponseSchema,
  'reports.reportCatalogResponseSchema': reportCatalogResponseSchema,
  'reports.reportResultResponseSchema': reportResultResponseSchema,
  'settings.bankAccountPageResponseSchema': bankAccountPageResponseSchema,
  'settings.bannerPageResponseSchema': bannerPageResponseSchema,
  'settings.couponPageSchema': couponPageSchema,
  'settings.holidayPageResponseSchema': holidayPageResponseSchema,
  'settings.hospitalProfileResponseSchema': hospitalProfileResponseSchema,
  'settings.hospitalSettingsResponseSchema': hospitalSettingsResponseSchema,
  'settings.numberingListResponseSchema': numberingListResponseSchema,
  'settings.scheduleHoursListResponseSchema': scheduleHoursListResponseSchema,
  'settings.servicePageSchema': servicePageSchema,
  'settings.taxRatePageSchema': taxRatePageSchema,
  'settings.tokenPolicyResponseSchema': tokenPolicyResponseSchema,
  'settlements.billingPlanPageResponseSchema': billingPlanPageResponseSchema,
  'settlements.invoiceDetailResponseSchema': invoiceDetailResponseSchema,
  'settlements.invoicePageResponseSchema': invoicePageResponseSchema,
  'settlements.planChangeRequestPageResponseSchema': planChangeRequestPageResponseSchema,
  'settlements.settlementPeriodDetailResponseSchema': settlementPeriodDetailResponseSchema,
  'settlements.settlementPeriodPageResponseSchema': settlementPeriodPageResponseSchema,
  'settlements.statementPageResponseSchema': statementPageResponseSchema,
  'settlements.subscriptionResponseSchema': subscriptionResponseSchema,
  'settlements.usageResponseSchema': usageResponseSchema,
  'slots.generationRunPageResponseSchema': generationRunPageResponseSchema,
  'slots.slotGridPageResponseSchema': slotGridPageResponseSchema,
  'token-queue.sessionPageSchema': sessionPageSchema,
  'users-roles.invitationPageResponseSchema': invitationPageResponseSchema,
  'users-roles.rolePageResponseSchema': usersRolesRolePageResponseSchema,
  'users-roles.rolePreviewResponseSchema': rolePreviewResponseSchema,
  'users-roles.staffPageResponseSchema': usersRolesStaffPageResponseSchema,
};

/** Read endpoints the recorder leaves out on purpose. A new GET that is neither recorded nor listed here fails the coverage test. */
const NOT_RECORDED: Readonly<Record<string, string>> = {
  receiptPdfResponseSchema: 'Reading it generates and stores the receipt PDF.',
  auditLogExportResponseSchema: 'Reading it starts an export file.',
  reportExportDeferredResponseSchema: 'Only sent for exports over 50,000 rows.',
  reportExportQueuedResponseSchema: 'Only sent for exports over 50,000 rows.',
  invitationPreviewResponseSchema: 'Needs a live invitation token.',
};

/** Item schemas that a paging helper wraps itself; the page fixture covers them. */
const COVERED_BY_PAGE: Readonly<Record<string, string>> = {
  loginEventResponseSchema: 'loginEventPageSchema',
  configChangeResponseSchema: 'configChangePageSchema',
};

const fixtures = import.meta.glob<unknown>('./fixtures/*.json', { eager: true, import: 'default' });
const apiSources = import.meta.glob<string>('/src/**/*.api.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

function fixtureKey(path: string): string {
  return path.replace('./fixtures/', '').replace(/\.json$/, '');
}

/** Schemas the app parses a GET response with, read from the API modules' source. */
function readSchemas(sources: Readonly<Record<string, string>>): Set<string> {
  const names = new Set<string>();
  for (const source of Object.values(sources)) {
    for (const fn of source.split(/\n(?=(?:export )?(?:async )?function )/)) {
      if (/\.get(?:<[^>]*>)?\(/.test(fn)) {
        for (const m of fn.matchAll(/(\w+Schema)\.parse\(/g)) names.add(m[1]);
      }
      for (const m of fn.matchAll(/(?:getAllPages|walkPages)\([^;]*?(\w+Schema)\b/g))
        names.add(m[1]);
    }
  }
  // The paging helpers' own parameter, not a schema of its own.
  names.delete('pageSchema');
  return names;
}

describe('recorded responses parse with the app’s schemas', () => {
  for (const [path, body] of Object.entries(fixtures)) {
    const key = fixtureKey(path);
    it(key, () => {
      const schema = CONTRACTS[key];
      expect(schema, `no schema registered for fixture ${key}`).toBeDefined();
      const result = schema.safeParse(body);
      expect(result.success ? [] : result.error.issues.slice(0, 5)).toEqual([]);
    });
  }
});

describe('contract coverage', () => {
  it('has a recorded response for every registered schema', () => {
    const recorded = new Set(Object.keys(fixtures).map(fixtureKey));
    expect(Object.keys(CONTRACTS).filter((key) => !recorded.has(key))).toEqual([]);
  });

  it('covers every schema the app reads with a GET', () => {
    const covered = new Set([
      ...Object.keys(CONTRACTS).map((key) => key.slice(key.indexOf('.') + 1)),
      ...Object.keys(NOT_RECORDED),
    ]);
    const uncovered = [...readSchemas(apiSources)].filter(
      (name) => !covered.has(COVERED_BY_PAGE[name] ?? name),
    );
    expect(uncovered).toEqual([]);
  });
});
