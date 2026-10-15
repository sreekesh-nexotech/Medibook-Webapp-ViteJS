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
  faqFeedSchema,
  supportTicketDetailSchema,
  supportTicketPageSchema,
} from '@/features/help/infrastructure/data-sources/remote/help.response';
import {
  adminDashboardResponseSchema,
  receptionDashboardResponseSchema,
} from '@/features/dashboard/infrastructure/data-sources/remote/dashboard.response';
import {
  dateExceptionPageSchema,
  departmentPageSchema,
  doctorPageSchema,
  doctorReviewPageSchema,
  leavePageSchema,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.api';
import {
  doctorResponseSchema,
  scheduleResponseSchema,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';
import {
  deliveryPageResponseSchema,
  templatePageResponseSchema,
} from '@/features/messaging/infrastructure/data-sources/remote/messaging.response';
import { hospitalAlertFeedResponseSchema } from '@/features/notifications/infrastructure/data-sources/remote/notifications.response';
import {
  apiErrorsResponseSchema,
  bookingsByMonthResponseSchema,
  departmentsSplitResponseSchema,
  overviewResponseSchema,
  providersResponseSchema,
  topHospitalsResponseSchema,
} from '@/features/ops-analytics/infrastructure/data-sources/remote/analytics.response';
import {
  billingSummarySchema,
  dunningPageSchema,
  invoiceDetailSchema,
  invoicePageSchema,
  paymentPageSchema,
  paymentSchema,
  planChangePageSchema,
  prorationPreviewSchema,
  subscriptionPageSchema,
  subscriptionSchema,
} from '@/features/ops-billing/infrastructure/data-sources/remote/billing.response';
import {
  ambulancePageResponseSchema,
  faqPageResponseSchema,
  legalDocumentPageResponseSchema,
  locationPageResponseSchema,
} from '@/features/ops-content/infrastructure/data-sources/remote/content.response';
import {
  configChangePageSchema,
  dataRequestPageSchema,
  dataRequestResponseSchema,
  loginEventPageSchema,
  phiAccessPageSchema,
  staffDirectoryPageSchema,
} from '@/features/ops-compliance/infrastructure/data-sources/remote/compliance.response';
import { opsDashboardResponseSchema } from '@/features/ops-dashboard/infrastructure/data-sources/remote/opsDashboard.response';
import { numberingSeriesResponseSchema as opsHospitalsNumberingSeriesResponseSchema } from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitalSettings.response';
import {
  commissionHistoryResponseSchema,
  hospitalDetailResponseSchema,
  hospitalPageResponseSchema,
  payoutBankAccountPageResponseSchema,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/hospitals.response';
import {
  caseDetailResponseSchema,
  caseListResponseSchema,
  requirementPageResponseSchema,
} from '@/features/ops-hospitals/infrastructure/data-sources/remote/onboarding.response';
import {
  logsPageResponseSchema,
  retentionResponseSchema,
} from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';
import { bannersPageResponseSchema } from '@/features/ops-notifications/infrastructure/data-sources/remote/notifications.response';
import {
  planPageResponseSchema,
  subscriberPageResponseSchema,
  subscriberRowsPageSchema,
} from '@/features/ops-plans/infrastructure/data-sources/remote/plans.response';
import {
  platformUserDetailResponseSchema,
  platformUsersPageResponseSchema,
} from '@/features/ops-platform-users/infrastructure/data-sources/remote/platformUsers.response';
import { reviewPageResponseSchema } from '@/features/ops-reviews/infrastructure/data-sources/remote/reviews.response';
import { messageTemplatePageResponseSchema } from '@/features/ops-message-templates/infrastructure/data-sources/remote/messageTemplates.response';
import { documentRequirementPageResponseSchema } from '@/features/ops-onboarding-documents/infrastructure/data-sources/remote/onboardingDocuments.response';
import {
  ticketDetailResponseSchema,
  ticketPageResponseSchema,
} from '@/features/ops-support/infrastructure/data-sources/remote/support.response';
import {
  reportListResponseSchema,
  reportResultResponseSchema as opsReportResultResponseSchema,
  reportSchedulePageResponseSchema,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';
import {
  featureFlagPageResponseSchema,
  platformSettingsResponseSchema,
  taxRatePageResponseSchema,
} from '@/features/ops-settings/infrastructure/data-sources/remote/opsSettings.response';
import {
  payoutPageResponseSchema as opsSettlementsPayoutPageResponseSchema,
  payoutRunDetailResponseSchema,
  payoutRunPageResponseSchema,
  periodDetailResponseSchema,
  periodPageResponseSchema,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.response';
import {
  assignableStaffPageResponseSchema,
  rolePageResponseSchema as opsUsersRolePageResponseSchema,
  staffPageResponseSchema as opsUsersStaffPageResponseSchema,
  permissionsResponseSchema,
} from '@/features/ops-users/infrastructure/data-sources/remote/opsUsers.response';
import {
  approvalRequestPageResponseSchema,
  hospitalPatientPageResponseSchema,
  hospitalPatientResponseSchema,
  patientAppointmentPageResponseSchema,
} from '@/features/patients/infrastructure/data-sources/remote/patients.response';
import {
  cashSessionPageResponseSchema,
  cashSummaryResponseSchema,
  paymentDetailResponseSchema,
  paymentPageResponseSchema,
  refundPageResponseSchema,
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
  couponRedemptionPageSchema,
  doctorServicePageSchema,
  servicePageSchema,
  taxRatePageSchema,
} from '@/features/settings/infrastructure/data-sources/remote/services.api';
import { settingsCounterPageSchema } from '@/features/settings/infrastructure/data-sources/remote/counters.response';
import { displayDevicePageSchema } from '@/features/settings/infrastructure/data-sources/remote/displayDevices.response';
import {
  numberingListResponseSchema,
  numberingPreviewResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/numbering.response';
import { printTemplatePageSchema } from '@/features/settings/infrastructure/data-sources/remote/printTemplates.response';
import {
  bankAccountPageResponseSchema,
  hospitalProfileResponseSchema,
  hospitalSettingsResponseSchema,
  scheduleHoursListResponseSchema,
  tokenPolicyResponseSchema,
} from '@/features/settings/infrastructure/data-sources/remote/settings.response';
import {
  billingPlanPageResponseSchema,
  creditNotePageResponseSchema,
  invoiceDetailResponseSchema,
  invoicePageResponseSchema,
  planChangeRequestPageResponseSchema,
  subscriptionResponseSchema,
  usageResponseSchema,
} from '@/features/settlements/infrastructure/data-sources/remote/billing.response';
import {
  payoutPageResponseSchema as settlementsPayoutPageResponseSchema,
  settlementPeriodDetailResponseSchema,
  settlementPeriodPageResponseSchema,
  statementPageResponseSchema,
} from '@/features/settlements/infrastructure/data-sources/remote/settlements.response';
import {
  generationRunPageResponseSchema,
  slotGridPageResponseSchema,
} from '@/features/slots/infrastructure/data-sources/remote/slots.response';
import { sessionPageSchema } from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.api';
import { tokenCallPageSchema } from '@/features/token-queue/infrastructure/data-sources/remote/tokenQueue.response';
import {
  invitationPageResponseSchema,
  rolePreviewResponseSchema,
  counterPageResponseSchema as usersRolesCounterPageResponseSchema,
  permissionCatalogueResponseSchema,
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
  'doctors.dateExceptionPageSchema': dateExceptionPageSchema,
  'help.supportTicketDetailSchema': supportTicketDetailSchema,
  'help.supportTicketPageSchema': supportTicketPageSchema,
  'help.faqFeedSchema': faqFeedSchema,
  'doctors.departmentPageSchema': departmentPageSchema,
  'doctors.doctorPageSchema': doctorPageSchema,
  'doctors.doctorResponseSchema': doctorResponseSchema,
  'doctors.doctorReviewPageSchema': doctorReviewPageSchema,
  'doctors.leavePageSchema': leavePageSchema,
  'doctors.scheduleResponseSchema': scheduleResponseSchema,
  'messaging.deliveryPageResponseSchema': deliveryPageResponseSchema,
  'messaging.templatePageResponseSchema': templatePageResponseSchema,
  'notifications.hospitalAlertFeedResponseSchema': hospitalAlertFeedResponseSchema,
  'ops-analytics.apiErrorsResponseSchema': apiErrorsResponseSchema,
  'ops-analytics.bookingsByMonthResponseSchema': bookingsByMonthResponseSchema,
  'ops-analytics.departmentsSplitResponseSchema': departmentsSplitResponseSchema,
  'ops-analytics.overviewResponseSchema': overviewResponseSchema,
  'ops-analytics.providersResponseSchema': providersResponseSchema,
  'ops-analytics.topHospitalsResponseSchema': topHospitalsResponseSchema,
  'ops-billing.dunningPageSchema': dunningPageSchema,
  'ops-billing.billingSummarySchema': billingSummarySchema,
  'ops-billing.invoiceDetailSchema': invoiceDetailSchema,
  'ops-billing.invoicePageSchema': invoicePageSchema,
  'ops-billing.paymentPageSchema': paymentPageSchema,
  'ops-billing.paymentSchema': paymentSchema,
  'ops-billing.planChangePageSchema': planChangePageSchema,
  'ops-billing.prorationPreviewSchema': prorationPreviewSchema,
  'ops-billing.subscriptionPageSchema': subscriptionPageSchema,
  'ops-billing.subscriptionSchema': subscriptionSchema,
  'ops-compliance.configChangePageSchema': configChangePageSchema,
  'ops-content.ambulancePageResponseSchema': ambulancePageResponseSchema,
  'ops-content.faqPageResponseSchema': faqPageResponseSchema,
  'ops-content.legalDocumentPageResponseSchema': legalDocumentPageResponseSchema,
  'ops-content.locationPageResponseSchema': locationPageResponseSchema,
  'ops-compliance.dataRequestPageSchema': dataRequestPageSchema,
  'ops-compliance.dataRequestResponseSchema': dataRequestResponseSchema,
  'ops-compliance.loginEventPageSchema': loginEventPageSchema,
  'ops-compliance.phiAccessPageSchema': phiAccessPageSchema,
  'ops-compliance.staffDirectoryPageSchema': staffDirectoryPageSchema,
  'ops-dashboard.opsDashboardResponseSchema': opsDashboardResponseSchema,
  'ops-hospitals.caseDetailResponseSchema': caseDetailResponseSchema,
  'ops-hospitals.caseListResponseSchema': caseListResponseSchema,
  'ops-hospitals.commissionHistoryResponseSchema': commissionHistoryResponseSchema,
  'ops-hospitals.hospitalDetailResponseSchema': hospitalDetailResponseSchema,
  'ops-hospitals.hospitalPageResponseSchema': hospitalPageResponseSchema,
  'ops-hospitals.numberingSeriesResponseSchema': opsHospitalsNumberingSeriesResponseSchema,
  'ops-hospitals.payoutBankAccountPageResponseSchema': payoutBankAccountPageResponseSchema,
  'ops-hospitals.requirementPageResponseSchema': requirementPageResponseSchema,
  'ops-logs.logsPageResponseSchema': logsPageResponseSchema,
  'ops-logs.retentionResponseSchema': retentionResponseSchema,
  'ops-notifications.bannersPageResponseSchema': bannersPageResponseSchema,
  'ops-plans.planPageResponseSchema': planPageResponseSchema,
  'ops-plans.subscriberPageResponseSchema': subscriberPageResponseSchema,
  'ops-plans.subscriberRowsPageSchema': subscriberRowsPageSchema,
  'ops-platform-users.platformUserDetailResponseSchema': platformUserDetailResponseSchema,
  'ops-platform-users.platformUsersPageResponseSchema': platformUsersPageResponseSchema,
  'ops-reports.reportListResponseSchema': reportListResponseSchema,
  'ops-reviews.reviewPageResponseSchema': reviewPageResponseSchema,
  'ops-support.ticketPageResponseSchema': ticketPageResponseSchema,
  'ops-message-templates.messageTemplatePageResponseSchema': messageTemplatePageResponseSchema,
  'ops-onboarding-documents.documentRequirementPageResponseSchema':
    documentRequirementPageResponseSchema,
  'ops-support.ticketDetailResponseSchema': ticketDetailResponseSchema,
  'ops-reports.reportResultResponseSchema': opsReportResultResponseSchema,
  'ops-reports.reportSchedulePageResponseSchema': reportSchedulePageResponseSchema,
  'ops-settings.featureFlagPageResponseSchema': featureFlagPageResponseSchema,
  'ops-settings.platformSettingsResponseSchema': platformSettingsResponseSchema,
  'ops-settings.taxRatePageResponseSchema': taxRatePageResponseSchema,
  'ops-settlements.payoutPageResponseSchema': opsSettlementsPayoutPageResponseSchema,
  'ops-settlements.payoutRunDetailResponseSchema': payoutRunDetailResponseSchema,
  'ops-settlements.payoutRunPageResponseSchema': payoutRunPageResponseSchema,
  'ops-settlements.periodDetailResponseSchema': periodDetailResponseSchema,
  'ops-settlements.periodPageResponseSchema': periodPageResponseSchema,
  'ops-users.assignableStaffPageResponseSchema': assignableStaffPageResponseSchema,
  'ops-users.permissionsResponseSchema': permissionsResponseSchema,
  'ops-users.rolePageResponseSchema': opsUsersRolePageResponseSchema,
  'ops-users.staffPageResponseSchema': opsUsersStaffPageResponseSchema,
  'patients.approvalRequestPageResponseSchema': approvalRequestPageResponseSchema,
  'patients.hospitalPatientPageResponseSchema': hospitalPatientPageResponseSchema,
  'patients.hospitalPatientResponseSchema': hospitalPatientResponseSchema,
  'patients.patientAppointmentPageResponseSchema': patientAppointmentPageResponseSchema,
  'payments.cashSessionPageResponseSchema': cashSessionPageResponseSchema,
  'payments.cashSummaryResponseSchema': cashSummaryResponseSchema,
  'payments.paymentDetailResponseSchema': paymentDetailResponseSchema,
  'payments.paymentPageResponseSchema': paymentPageResponseSchema,
  'payments.refundPageResponseSchema': refundPageResponseSchema,
  'payments.visitReceiptPageResponseSchema': visitReceiptPageResponseSchema,
  'profile.activeSessionsPageResponseSchema': activeSessionsPageResponseSchema,
  'reports.reportCatalogResponseSchema': reportCatalogResponseSchema,
  'reports.reportResultResponseSchema': reportResultResponseSchema,
  'settings.bankAccountPageResponseSchema': bankAccountPageResponseSchema,
  'settings.bannerPageResponseSchema': bannerPageResponseSchema,
  'settings.couponPageSchema': couponPageSchema,
  'settings.couponRedemptionPageSchema': couponRedemptionPageSchema,
  'settings.displayDevicePageSchema': displayDevicePageSchema,
  'settings.doctorServicePageSchema': doctorServicePageSchema,
  'settings.holidayPageResponseSchema': holidayPageResponseSchema,
  'settings.hospitalProfileResponseSchema': hospitalProfileResponseSchema,
  'settings.hospitalSettingsResponseSchema': hospitalSettingsResponseSchema,
  'settings.numberingListResponseSchema': numberingListResponseSchema,
  'settings.numberingPreviewResponseSchema': numberingPreviewResponseSchema,
  'settings.printTemplatePageSchema': printTemplatePageSchema,
  'settings.scheduleHoursListResponseSchema': scheduleHoursListResponseSchema,
  'settings.servicePageSchema': servicePageSchema,
  'settings.settingsCounterPageSchema': settingsCounterPageSchema,
  'settings.taxRatePageSchema': taxRatePageSchema,
  'settings.tokenPolicyResponseSchema': tokenPolicyResponseSchema,
  'settlements.billingPlanPageResponseSchema': billingPlanPageResponseSchema,
  'settlements.creditNotePageResponseSchema': creditNotePageResponseSchema,
  'settlements.invoiceDetailResponseSchema': invoiceDetailResponseSchema,
  'settlements.invoicePageResponseSchema': invoicePageResponseSchema,
  'settlements.planChangeRequestPageResponseSchema': planChangeRequestPageResponseSchema,
  'settlements.payoutPageResponseSchema': settlementsPayoutPageResponseSchema,
  'settlements.settlementPeriodDetailResponseSchema': settlementPeriodDetailResponseSchema,
  'settlements.settlementPeriodPageResponseSchema': settlementPeriodPageResponseSchema,
  'settlements.statementPageResponseSchema': statementPageResponseSchema,
  'settlements.subscriptionResponseSchema': subscriptionResponseSchema,
  'settlements.usageResponseSchema': usageResponseSchema,
  'slots.generationRunPageResponseSchema': generationRunPageResponseSchema,
  'slots.slotGridPageResponseSchema': slotGridPageResponseSchema,
  'token-queue.sessionPageSchema': sessionPageSchema,
  'token-queue.tokenCallPageSchema': tokenCallPageSchema,
  'users-roles.counterPageResponseSchema': usersRolesCounterPageResponseSchema,
  'users-roles.invitationPageResponseSchema': invitationPageResponseSchema,
  'users-roles.permissionCatalogueResponseSchema': permissionCatalogueResponseSchema,
  'users-roles.rolePageResponseSchema': usersRolesRolePageResponseSchema,
  'users-roles.rolePreviewResponseSchema': rolePreviewResponseSchema,
  'users-roles.staffPageResponseSchema': usersRolesStaffPageResponseSchema,
};

/**
 * Read endpoints the recorder leaves out on purpose: each one writes, mints a
 * one-off signed link, needs a one-time token, or answers a non-JSON body. A
 * new GET that is neither recorded nor listed here fails the coverage test.
 */
const NOT_RECORDED: Readonly<Record<string, string>> = {
  receiptPdfResponseSchema:
    'GET /hospital/appointments/{id}/receipt.pdf renders and stores the PDF when the worker has not, and mints a signed link.',
  statementPdfLinkSchema:
    'GET /platform/statements/{id}.pdf renders and stores the statement PDF on first read and mints a signed link (SET-02).',
  auditLogExportResponseSchema:
    'GET /hospital/audit/log/export.csv answers a CSV file (parsed as text), not JSON.',
  logsExportResponseSchema:
    'GET /platform/logs/export.csv answers a CSV file (parsed as text), not JSON.',
  reportExportDeferredResponseSchema:
    'The 202 of GET /platform/reports/{code}/export.{fmt}: only past the sync row limit (50,000; 2,000 for PDF), and it queues a worker export.',
  reportExportQueuedResponseSchema:
    'The 202 of GET /hospital/reports/{code}/export.{fmt}: only past the sync row limit (50,000; 2,000 for PDF), and it queues a worker export.',
  invitationPreviewResponseSchema:
    'GET /hospital/auth/invitations/{token} needs a live one-time invitation token from the invite email.',
};

/** Item schemas that a paging helper wraps itself; the page fixture covers them. */
const COVERED_BY_PAGE: Readonly<Record<string, string>> = {
  loginEventResponseSchema: 'loginEventPageSchema',
  configChangeResponseSchema: 'configChangePageSchema',
  deliveryResponseSchema: 'deliveryPageResponseSchema',
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
