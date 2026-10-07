#!/usr/bin/env node
/**
 * Records real backend responses for the API contract tests
 * (`src/test/contract/apiContract.test.ts`).
 *
 * Read-only: it signs in once per console and sends only GET requests. Every
 * response is scrubbed before it is written, because the fixtures are
 * committed: GSTIN, PAN, bank and phone numbers keep their format but lose
 * their digits, IP addresses and user agents are replaced, email addresses
 * outside example domains are replaced, and URLs lose their host and
 * signature.
 *
 * Usage, against a seeded backend (staging or the dev proxy):
 *
 *   FIXTURE_API_BASE=http://localhost:5173/api/v1 \
 *   FIXTURE_HOSPITAL_EMAIL=admin@hospital.example.com \
 *   FIXTURE_PLATFORM_EMAIL=owner@medibook.example.com \
 *   FIXTURE_PASSWORD=… \
 *   node scripts/record-api-fixtures.mjs
 *
 * Add `FIXTURE_ONLY=<key>,<key>` to rewrite only those fixtures.
 *
 * Use a hospital admin (every hospital endpoint) and a platform owner.
 *
 * `FIXTURE_ONLY=key1,key2` still reads every endpoint (later entries take
 * their ids from earlier ones) but writes only the listed fixtures, so a new
 * schema can be recorded without re-recording — and churning — the others.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT_DIR = fileURLToPath(new URL('../src/test/contract/fixtures/', import.meta.url));
const LIST = { page_size: 5 };
const WIDE_DATES = { date_from: '2026-01-01', date_to: '2026-12-31' };

const base = required('FIXTURE_API_BASE').replace(/\/+$/, '');
/**
 * Optional comma list of fixture keys to (re)write; the others are still read
 * (later entries need their ids) but their files are left untouched.
 */
const only = new Set(
  (process.env.FIXTURE_ONLY ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean),
);
const password = required('FIXTURE_PASSWORD');
const accounts = {
  hospital: required('FIXTURE_HOSPITAL_EMAIL'),
  platform: required('FIXTURE_PLATFORM_EMAIL'),
};

function required(name) {
  const value = process.env[name];
  if (!value) {
    process.stderr.write(`Set ${name}. See the header of this script.\n`);
    process.exit(1);
  }
  return value;
}

/** First row of a recorded list, or the first row matching `test`. */
function first(fx, key, test = () => true) {
  const body = fx[key];
  const rows = Array.isArray(body) ? body : body?.results;
  return Array.isArray(rows) ? (rows.find(test) ?? null) : null;
}

/**
 * Every GET the app parses, keyed `<feature>.<schema>`. `path` placeholders
 * (`{id}`) come from `needs`, which reads earlier fixtures; an entry whose
 * needs cannot be met (an empty list) is skipped and reported.
 */
const SPEC = [
  // shared and auth
  { key: 'core.appConfigResponseSchema', surface: 'public', path: '/shared/app-config' },
  { key: 'auth.hospitalMeResponseSchema', surface: 'hospital', path: '/hospital/me' },
  { key: 'auth.platformMeResponseSchema', surface: 'platform', path: '/platform/me' },
  {
    key: 'profile.activeSessionsPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/auth/sessions',
    params: LIST,
  },

  // hospital: front desk
  {
    key: 'appointments.appointmentPageSchema',
    surface: 'hospital',
    path: '/hospital/appointments',
    params: { ...LIST, ...WIDE_DATES },
  },
  {
    key: 'appointments.appointmentResponseSchema',
    surface: 'hospital',
    path: '/hospital/appointments/{id}',
    needs: (fx) => ({ id: first(fx, 'appointments.appointmentPageSchema')?.id }),
  },
  {
    key: 'appointments.eventPageSchema',
    surface: 'hospital',
    path: '/hospital/appointments/{id}/events',
    needs: (fx) => ({ id: first(fx, 'appointments.appointmentPageSchema')?.id }),
  },
  {
    key: 'appointments.receiptResponseSchema',
    surface: 'hospital',
    path: '/hospital/appointments/{id}/receipt',
    needs: (fx) => ({
      id: first(fx, 'appointments.appointmentPageSchema', (a) => a.payment_status === 'paid')?.id,
    }),
  },
  {
    key: 'appointments.tokenSlipResponseSchema',
    surface: 'hospital',
    path: '/hospital/appointments/{id}/token-slip',
    needs: (fx) => ({
      id: first(
        fx,
        'appointments.appointmentPageSchema',
        (a) => a.token_no != null || a.token_number != null,
      )?.id,
    }),
  },
  {
    key: 'dashboard.adminDashboardResponseSchema',
    surface: 'hospital',
    path: '/hospital/dashboard/admin',
  },
  {
    key: 'dashboard.receptionDashboardResponseSchema',
    surface: 'hospital',
    path: '/hospital/dashboard/reception',
  },
  {
    key: 'notifications.hospitalAlertFeedResponseSchema',
    surface: 'hospital',
    path: '/hospital/notifications',
  },
  {
    key: 'patients.hospitalPatientPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/patients',
    params: LIST,
  },
  {
    key: 'patients.hospitalPatientResponseSchema',
    surface: 'hospital',
    path: '/hospital/patients/{id}',
    needs: (fx) => ({ id: first(fx, 'patients.hospitalPatientPageResponseSchema')?.id }),
  },
  {
    key: 'patients.patientAppointmentPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/patients/{id}/appointments',
    params: LIST,
    needs: (fx) => ({ id: first(fx, 'patients.hospitalPatientPageResponseSchema')?.id }),
  },
  {
    key: 'patients.approvalRequestPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/patient-approvals',
    params: LIST,
  },
  {
    key: 'token-queue.sessionPageSchema',
    surface: 'hospital',
    path: '/hospital/sessions',
    params: { ...LIST, date: new Date().toISOString().slice(0, 10) },
  },
  {
    key: 'token-queue.tokenCallPageSchema',
    surface: 'hospital',
    path: '/hospital/sessions/{id}/calls',
    params: LIST,
    needs: (fx) => ({
      id: (
        first(fx, 'token-queue.sessionPageSchema', (s) => s.last_called_token_no != null) ??
        first(fx, 'token-queue.sessionPageSchema')
      )?.id,
    }),
  },

  // hospital: help & support
  {
    key: 'help.supportTicketPageSchema',
    surface: 'hospital',
    path: '/hospital/support/tickets',
    params: LIST,
  },
  {
    key: 'help.supportTicketDetailSchema',
    surface: 'hospital',
    path: '/hospital/support/tickets/{id}',
    needs: (fx) => ({ id: first(fx, 'help.supportTicketPageSchema')?.id }),
  },

  // hospital: payments and cash
  {
    key: 'payments.paymentPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/payments',
    params: { ...LIST, ...WIDE_DATES },
  },
  {
    key: 'payments.paymentDetailResponseSchema',
    surface: 'hospital',
    path: '/hospital/payments/{id}',
    needs: (fx) => ({ id: first(fx, 'payments.paymentPageResponseSchema')?.id }),
  },
  {
    key: 'payments.visitReceiptPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/visits/{id}/receipts',
    needs: (fx) => ({
      id: first(fx, 'appointments.appointmentPageSchema', (a) => a.visit_id)?.visit_id,
    }),
  },
  {
    key: 'payments.cashSessionPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/cash-sessions',
    params: LIST,
  },

  // hospital: doctors, slots, catalogue
  {
    key: 'doctors.departmentPageSchema',
    surface: 'hospital',
    path: '/hospital/departments',
    params: LIST,
  },
  { key: 'doctors.doctorPageSchema', surface: 'hospital', path: '/hospital/doctors', params: LIST },
  {
    key: 'doctors.doctorResponseSchema',
    surface: 'hospital',
    path: '/hospital/doctors/{id}',
    needs: (fx) => ({ id: first(fx, 'doctors.doctorPageSchema')?.id }),
  },
  {
    key: 'doctors.scheduleResponseSchema',
    surface: 'hospital',
    path: '/hospital/doctors/{id}/schedule',
    needs: (fx) => ({ id: first(fx, 'doctors.doctorPageSchema')?.id }),
  },
  {
    key: 'slots.slotGridPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/slots',
    params: { ...LIST, date: new Date().toISOString().slice(0, 10) },
  },
  {
    key: 'slots.generationRunPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/slots/generation-runs',
    params: LIST,
  },
  {
    key: 'settings.servicePageSchema',
    surface: 'hospital',
    path: '/hospital/services',
    params: LIST,
  },
  {
    key: 'settings.taxRatePageSchema',
    surface: 'hospital',
    path: '/hospital/tax-rates',
    params: LIST,
  },
  {
    key: 'settings.couponPageSchema',
    surface: 'hospital',
    path: '/hospital/coupons',
    params: LIST,
  },

  // hospital: settings and profile
  { key: 'settings.hospitalProfileResponseSchema', surface: 'hospital', path: '/hospital/profile' },
  {
    key: 'settings.hospitalSettingsResponseSchema',
    surface: 'hospital',
    path: '/hospital/settings',
  },
  { key: 'settings.scheduleHoursListResponseSchema', surface: 'hospital', path: '/hospital/hours' },
  {
    key: 'settings.tokenPolicyResponseSchema',
    surface: 'hospital',
    path: '/hospital/token-policy',
  },
  {
    key: 'settings.holidayPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/holidays',
    params: LIST,
  },
  {
    key: 'settings.bannerPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/banners',
    params: LIST,
  },
  {
    key: 'settings.bankAccountPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/billing/bank-accounts',
    params: LIST,
  },
  {
    key: 'settings.settingsCounterPageSchema',
    surface: 'hospital',
    path: '/hospital/counters',
    params: { page_size: 100 },
  },
  {
    key: 'settings.numberingListResponseSchema',
    surface: 'hospital',
    path: '/hospital/numbering',
  },
  {
    key: 'settings.numberingPreviewResponseSchema',
    surface: 'hospital',
    path: '/hospital/numbering/receipt/preview',
  },
  {
    key: 'settings.printTemplatePageSchema',
    surface: 'hospital',
    path: '/hospital/print-templates',
    params: LIST,
  },
  {
    key: 'settings.displayDevicePageSchema',
    surface: 'hospital',
    path: '/hospital/display-devices',
    params: LIST,
  },

  // hospital: billing, settlements, reports, messaging, audit, users
  {
    key: 'settlements.subscriptionResponseSchema',
    surface: 'hospital',
    path: '/hospital/billing/subscription',
  },
  { key: 'settlements.usageResponseSchema', surface: 'hospital', path: '/hospital/billing/usage' },
  {
    key: 'settlements.invoicePageResponseSchema',
    surface: 'hospital',
    path: '/hospital/billing/invoices',
    params: LIST,
  },
  {
    key: 'settlements.invoiceDetailResponseSchema',
    surface: 'hospital',
    path: '/hospital/billing/invoices/{id}',
    needs: (fx) => ({ id: first(fx, 'settlements.invoicePageResponseSchema')?.id }),
  },
  {
    key: 'settlements.billingPlanPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/billing/plans',
    params: LIST,
  },
  {
    key: 'settlements.planChangeRequestPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/billing/plan-change-requests',
    params: LIST,
  },
  {
    key: 'settlements.settlementPeriodPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/settlements/periods',
    params: LIST,
  },
  {
    key: 'settlements.settlementPeriodDetailResponseSchema',
    surface: 'hospital',
    path: '/hospital/settlements/periods/{id}',
    needs: (fx) => ({ id: first(fx, 'settlements.settlementPeriodPageResponseSchema')?.id }),
  },
  {
    key: 'settlements.statementPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/statements',
    params: LIST,
  },
  {
    key: 'settlements.payoutPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/settlements/payouts',
    params: LIST,
  },
  {
    key: 'settlements.creditNotePageResponseSchema',
    surface: 'hospital',
    path: '/hospital/billing/credit-notes',
    params: LIST,
  },
  { key: 'reports.reportCatalogResponseSchema', surface: 'hospital', path: '/hospital/reports' },
  {
    key: 'reports.reportResultResponseSchema',
    surface: 'hospital',
    path: '/hospital/reports/{code}',
    params: { page: 1, page_size: 5 },
    needs: (fx) => ({ code: first(fx, 'reports.reportCatalogResponseSchema')?.code }),
  },
  {
    key: 'messaging.templatePageResponseSchema',
    surface: 'hospital',
    path: '/hospital/messaging/templates',
    params: LIST,
  },
  {
    key: 'messaging.deliveryPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/messaging/deliveries',
    params: LIST,
  },
  {
    key: 'audit.auditLogPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/audit/log',
    params: LIST,
  },
  {
    key: 'users-roles.staffPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/staff',
    params: LIST,
  },
  {
    key: 'users-roles.invitationPageResponseSchema',
    surface: 'hospital',
    path: '/hospital/staff/invitations',
    params: LIST,
  },
  {
    key: 'users-roles.rolePageResponseSchema',
    surface: 'hospital',
    path: '/hospital/roles',
    params: LIST,
  },
  {
    key: 'users-roles.rolePreviewResponseSchema',
    surface: 'hospital',
    path: '/hospital/roles/receptionist/preview',
  },

  // platform: hospitals and onboarding
  {
    key: 'ops-dashboard.opsDashboardResponseSchema',
    surface: 'platform',
    path: '/platform/dashboard',
  },
  {
    key: 'ops-hospitals.hospitalPageResponseSchema',
    surface: 'platform',
    path: '/platform/hospitals',
    params: LIST,
  },
  {
    key: 'ops-hospitals.hospitalDetailResponseSchema',
    surface: 'platform',
    path: '/platform/hospitals/{id}',
    needs: (fx) => ({
      id: first(fx, 'ops-hospitals.hospitalPageResponseSchema', (h) => h.status === 'active')?.id,
    }),
  },
  {
    key: 'ops-hospitals.numberingSeriesResponseSchema',
    surface: 'platform',
    path: '/platform/hospitals/{id}/numbering/booking',
    needs: (fx) => ({ id: fx['ops-hospitals.hospitalDetailResponseSchema']?.id }),
  },
  {
    key: 'ops-hospitals.commissionHistoryResponseSchema',
    surface: 'platform',
    path: '/platform/hospitals/{id}/commission-history',
    needs: (fx) => ({ id: fx['ops-hospitals.hospitalDetailResponseSchema']?.id }),
  },
  {
    key: 'ops-hospitals.payoutBankAccountPageResponseSchema',
    surface: 'platform',
    path: '/platform/hospitals/{id}/bank-accounts',
    params: LIST,
    needs: (fx) => ({ id: fx['ops-hospitals.hospitalDetailResponseSchema']?.id }),
  },
  {
    key: 'ops-hospitals.caseListResponseSchema',
    surface: 'platform',
    path: '/platform/onboarding/cases',
    params: LIST,
  },
  {
    key: 'ops-hospitals.caseDetailResponseSchema',
    surface: 'platform',
    path: '/platform/onboarding/cases/{id}',
    needs: (fx) => ({
      id: (
        first(fx, 'ops-hospitals.caseListResponseSchema', (c) => c.stage === 'live') ??
        first(fx, 'ops-hospitals.caseListResponseSchema')
      )?.id,
    }),
  },
  {
    key: 'ops-hospitals.requirementPageResponseSchema',
    surface: 'platform',
    path: '/platform/onboarding/document-requirements',
    params: { page_size: 100 },
  },

  // platform: plans, billing, settlements
  {
    key: 'ops-plans.planPageResponseSchema',
    surface: 'platform',
    path: '/platform/plans',
    params: LIST,
  },
  {
    key: 'ops-plans.subscriberPageResponseSchema',
    surface: 'platform',
    path: '/platform/plans/{id}/subscribers',
    params: LIST,
    needs: (fx) => ({ id: first(fx, 'ops-plans.planPageResponseSchema')?.id }),
  },
  {
    key: 'ops-plans.subscriberRowsPageSchema',
    surface: 'platform',
    path: '/platform/plans/{id}/subscribers',
    params: { ...LIST, status: 'trialing,active,past_due,grace,read_only' },
    needs: (fx) => ({ id: first(fx, 'ops-plans.planPageResponseSchema')?.id }),
  },
  {
    key: 'ops-billing.invoicePageSchema',
    surface: 'platform',
    path: '/platform/billing/invoices',
    params: LIST,
  },
  {
    key: 'ops-billing.invoiceDetailSchema',
    surface: 'platform',
    path: '/platform/billing/invoices/{id}',
    needs: (fx) => ({ id: first(fx, 'ops-billing.invoicePageSchema')?.id }),
  },
  {
    key: 'ops-billing.paymentPageSchema',
    surface: 'platform',
    path: '/platform/billing/payments',
    params: LIST,
  },
  {
    key: 'ops-billing.paymentSchema',
    surface: 'platform',
    path: '/platform/billing/payments/{id}',
    needs: (fx) => ({ id: first(fx, 'ops-billing.paymentPageSchema')?.id }),
  },
  {
    key: 'ops-billing.billingSummarySchema',
    surface: 'platform',
    path: '/platform/billing/summary',
  },
  {
    key: 'ops-billing.subscriptionPageSchema',
    surface: 'platform',
    path: '/platform/billing/subscriptions',
    params: LIST,
  },
  {
    key: 'ops-billing.dunningPageSchema',
    surface: 'platform',
    path: '/platform/billing/dunning',
    params: LIST,
  },
  {
    key: 'ops-billing.subscriptionSchema',
    surface: 'platform',
    path: '/platform/billing/subscriptions/{id}',
    needs: (fx) => ({ id: fx['ops-hospitals.hospitalDetailResponseSchema']?.subscription?.id }),
  },
  {
    key: 'ops-billing.prorationPreviewSchema',
    surface: 'platform',
    path: '/platform/billing/subscriptions/{id}/proration-preview',
    params: { billing_period: 'yearly' },
    needs: (fx) => ({ id: fx['ops-hospitals.hospitalDetailResponseSchema']?.subscription?.id }),
  },
  {
    key: 'ops-billing.planChangePageSchema',
    surface: 'platform',
    path: '/platform/billing/plan-change-requests',
    params: LIST,
  },
  {
    key: 'ops-settlements.periodPageResponseSchema',
    surface: 'platform',
    path: '/platform/settlements/periods',
    params: LIST,
  },
  {
    key: 'ops-settlements.periodDetailResponseSchema',
    surface: 'platform',
    path: '/platform/settlements/periods/{id}',
    needs: (fx) => ({ id: first(fx, 'ops-settlements.periodPageResponseSchema')?.id }),
  },
  {
    key: 'ops-settlements.payoutPageResponseSchema',
    surface: 'platform',
    path: '/platform/settlements/payouts',
    params: LIST,
  },
  {
    key: 'ops-settlements.payoutRunPageResponseSchema',
    surface: 'platform',
    path: '/platform/settlements/payout-runs',
    params: LIST,
  },
  {
    key: 'ops-settlements.payoutRunDetailResponseSchema',
    surface: 'platform',
    path: '/platform/settlements/payout-runs/{id}',
    needs: (fx) => ({ id: first(fx, 'ops-settlements.payoutRunPageResponseSchema')?.id }),
  },

  // platform: people, settings, compliance, logs, analytics, reports, banners
  {
    key: 'ops-platform-users.platformUsersPageResponseSchema',
    surface: 'platform',
    path: '/platform/users',
    params: LIST,
  },
  {
    key: 'ops-platform-users.platformUserDetailResponseSchema',
    surface: 'platform',
    path: '/platform/users/{id}',
    needs: (fx) => ({ id: first(fx, 'ops-platform-users.platformUsersPageResponseSchema')?.id }),
  },
  {
    key: 'ops-users.staffPageResponseSchema',
    surface: 'platform',
    path: '/platform/staff',
    params: LIST,
  },
  {
    key: 'ops-users.rolePageResponseSchema',
    surface: 'platform',
    path: '/platform/roles',
    params: LIST,
  },
  {
    key: 'ops-users.permissionsResponseSchema',
    surface: 'platform',
    path: '/platform/permissions',
  },
  {
    key: 'ops-settings.platformSettingsResponseSchema',
    surface: 'platform',
    path: '/platform/settings',
  },
  {
    key: 'ops-settings.featureFlagPageResponseSchema',
    surface: 'platform',
    path: '/platform/feature-flags',
    params: LIST,
  },
  {
    key: 'ops-settings.taxRatePageResponseSchema',
    surface: 'platform',
    path: '/platform/tax-rates',
    params: LIST,
  },
  {
    key: 'ops-compliance.loginEventPageSchema',
    surface: 'platform',
    path: '/platform/compliance/login-history',
    params: LIST,
  },
  {
    key: 'ops-compliance.configChangePageSchema',
    surface: 'platform',
    path: '/platform/compliance/config-changes',
    params: LIST,
  },
  {
    key: 'ops-compliance.dataRequestPageSchema',
    surface: 'platform',
    path: '/platform/compliance/data-requests',
    params: LIST,
  },
  {
    key: 'ops-compliance.dataRequestResponseSchema',
    surface: 'platform',
    path: '/platform/compliance/data-requests/{id}',
    needs: (fx) => ({ id: first(fx, 'ops-compliance.dataRequestPageSchema')?.id }),
  },
  {
    key: 'ops-logs.logsPageResponseSchema',
    surface: 'platform',
    path: '/platform/logs',
    params: { page: 1, page_size: 5 },
  },
  {
    key: 'ops-notifications.bannersPageResponseSchema',
    surface: 'platform',
    path: '/platform/banners',
    params: LIST,
  },
  {
    key: 'ops-content.legalDocumentPageResponseSchema',
    surface: 'platform',
    path: '/platform/legal-documents',
    params: LIST,
  },
  {
    key: 'ops-content.faqPageResponseSchema',
    surface: 'platform',
    path: '/platform/faqs',
    params: LIST,
  },
  {
    key: 'ops-content.locationPageResponseSchema',
    surface: 'platform',
    path: '/platform/locations',
    params: LIST,
  },
  {
    key: 'ops-content.ambulancePageResponseSchema',
    surface: 'platform',
    path: '/platform/ambulance-providers',
    params: LIST,
  },
  {
    key: 'ops-message-templates.messageTemplatePageResponseSchema',
    surface: 'platform',
    path: '/platform/messaging/templates',
    params: LIST,
  },
  {
    key: 'ops-onboarding-documents.documentRequirementPageResponseSchema',
    surface: 'platform',
    path: '/platform/onboarding/document-requirements',
    params: LIST,
  },
  {
    key: 'ops-support.ticketPageResponseSchema',
    surface: 'platform',
    path: '/platform/support/tickets',
    params: LIST,
  },
  {
    key: 'ops-support.ticketDetailResponseSchema',
    surface: 'platform',
    path: '/platform/support/tickets/{id}',
    needs: (fx) => ({ id: first(fx, 'ops-support.ticketPageResponseSchema')?.id }),
  },
  {
    key: 'ops-reviews.reviewPageResponseSchema',
    surface: 'platform',
    path: '/platform/reviews',
    params: LIST,
  },
  { key: 'ops-reports.reportListResponseSchema', surface: 'platform', path: '/platform/reports' },
  {
    key: 'ops-reports.reportResultResponseSchema',
    surface: 'platform',
    path: '/platform/reports/bookings',
    params: { page: 1, page_size: 5, booking_date_from: '2026-01-01' },
  },
  {
    key: 'ops-reports.reportSchedulePageResponseSchema',
    surface: 'platform',
    path: '/platform/report-schedules',
    params: LIST,
  },
  {
    key: 'ops-analytics.overviewResponseSchema',
    surface: 'platform',
    path: '/platform/analytics/overview',
    params: { period: '30d' },
  },
  {
    key: 'ops-analytics.bookingsByMonthResponseSchema',
    surface: 'platform',
    path: '/platform/analytics/bookings-by-month',
    params: { period: '12m' },
  },
  {
    key: 'ops-analytics.departmentsSplitResponseSchema',
    surface: 'platform',
    path: '/platform/analytics/departments-split',
    params: { period: '30d' },
  },
  {
    key: 'ops-analytics.topHospitalsResponseSchema',
    surface: 'platform',
    path: '/platform/analytics/top-hospitals',
    params: { period: '30d' },
  },
  {
    key: 'ops-analytics.providersResponseSchema',
    surface: 'platform',
    path: '/platform/analytics/providers',
    params: { period: '30d' },
  },
  {
    key: 'ops-analytics.apiErrorsResponseSchema',
    surface: 'platform',
    path: '/platform/analytics/errors',
    params: { period: '30d' },
  },

  // files: a stored KYC scan the platform owns
  {
    key: 'core.storedFileResponseSchema',
    surface: 'platform',
    path: '/shared/files/{id}',
    needs: (fx) => ({ id: kycFileId(fx) }),
  },
  {
    key: 'core.signedUrlResponseSchema',
    surface: 'platform',
    path: '/shared/files/{id}/url',
    needs: (fx) => ({ id: kycFileId(fx) }),
  },
];

function kycFileId(fx) {
  const text = JSON.stringify(fx['ops-hospitals.caseDetailResponseSchema'] ?? {});
  return /"file_id":"([0-9a-f-]{36})"/.exec(text)?.[1] ?? null;
}

/* ------------------------------------------------------------- scrubbing */

const EXAMPLE_DOMAIN = /(^|\.)example\.(com|test|org)$/i;
const EMAIL = /^[^\s@]+@([^\s@]+)$/;
const IPV4 = /\b\d{1,3}(\.\d{1,3}){3}\b/g;
const URL_PREFIX = /^https?:\/\//i;
const MASKED_KEY =
  /(^|_)(gstin|pan|ifsc|upi|account_number|account_no|account_last4|last4|aadhaar|abha)(_|$)/i;
const PHONE_KEY = /(phone|mobile|whatsapp)/i;
/** Phone numbers also turn up under neutral keys, e.g. a delivery's `recipient_address`. */
const E164 = /^\+[1-9]\d{7,14}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Keep the shape (length, digit/letter positions, case) and drop the content. */
function maskFormat(value) {
  return value.replace(/[0-9]/g, '0').replace(/[A-Z]/g, 'A').replace(/[a-z]/g, 'a');
}

function scrubString(key, value) {
  if (/^(ip|ip_address|client_ip|remote_addr)$/i.test(key))
    return value.includes(':') ? '2001:db8::1' : '203.0.113.10';
  if (/user_agent/i.test(key)) return 'Mozilla/5.0 (fixture)';
  if (MASKED_KEY.test(key)) return maskFormat(value);
  if (PHONE_KEY.test(key))
    return value.startsWith('+')
      ? value.slice(0, 3) + value.slice(3).replace(/[0-9]/g, '0')
      : value.replace(/[0-9]/g, '0');
  if (E164.test(value)) return value.slice(0, 3) + value.slice(3).replace(/[0-9]/g, '0');
  if (INDIAN_MOBILE.test(value)) return value[0] + '0'.repeat(value.length - 1);
  const email = EMAIL.exec(value);
  if (email && !EXAMPLE_DOMAIN.test(email[1])) return 'user@example.com';
  if (URL_PREFIX.test(value)) {
    try {
      const url = new URL(value);
      return `https://files.example.test${url.pathname}`;
    } catch {
      return 'https://files.example.test/';
    }
  }
  return value.replace(IPV4, '203.0.113.10');
}

function scrub(node, key = '') {
  if (Array.isArray(node)) return node.map((item) => scrub(item, key));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, scrub(v, k)]));
  }
  return typeof node === 'string' ? scrubString(key, node) : node;
}

/* --------------------------------------------------------------- record */

async function login(surface) {
  const response = await fetch(`${base}/${surface}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: accounts[surface], password }),
  });
  if (!response.ok) throw new Error(`${surface} sign-in failed (${response.status})`);
  return (await response.json()).access;
}

const tokens = { hospital: await login('hospital'), platform: await login('platform') };
mkdirSync(OUT_DIR, { recursive: true });

const fixtures = {};
const report = [];
for (const entry of SPEC) {
  const ids = entry.needs ? entry.needs(fixtures) : {};
  const missing = Object.entries(ids)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    report.push([entry.key, 'skipped: no record to read']);
    continue;
  }
  const path = entry.path.replace(/\{(\w+)\}/g, (_, name) => encodeURIComponent(ids[name]));
  const query = new URLSearchParams(
    Object.entries(entry.params ?? {}).map(([k, v]) => [k, String(v)]),
  );
  const url = `${base}${path}${query.size ? `?${query}` : ''}`;
  const headers =
    entry.surface === 'public' ? {} : { Authorization: `Bearer ${tokens[entry.surface]}` };
  const response = await fetch(url, { headers });
  if (!response.ok) {
    report.push([entry.key, `skipped: HTTP ${response.status}`]);
    continue;
  }
  const body = await response.json();
  fixtures[entry.key] = body;
  if (only.size > 0 && !only.has(entry.key)) {
    report.push([entry.key, 'read, not written (FIXTURE_ONLY)']);
    continue;
  }
  writeFileSync(`${OUT_DIR}${entry.key}.json`, `${JSON.stringify(scrub(body), null, 2)}\n`);
  report.push([entry.key, 'recorded']);
}

const recorded = report.filter(([, s]) => s === 'recorded').length;
process.stdout.write(
  `Recorded ${recorded} of ${SPEC.length} responses into src/test/contract/fixtures/\n`,
);
for (const [key, status] of report) {
  if (status !== 'recorded' && !status.startsWith('read,'))
    process.stdout.write(`  ${key}: ${status}\n`);
}
