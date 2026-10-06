# Backend blockers for go-live

Issues from the go-live checklist's "Day-one workflows that fail today" that the web
app cannot fix on its own, plus related backend gaps found while fixing the rest.
Each entry says what fails, the evidence, what the backend needs to change, and what
the web app does in the meantime.

Found on 6 Oct 2026 against the shared test backend, branch `claude/core-day-one`.
Paths under `backend:` are in the Django repository.

## Summary

| ID        | Problem                                                       | Severity | Web app status                         |
| --------- | ------------------------------------------------------------- | -------- | -------------------------------------- |
| CORE-07   | Receptionists cannot book appointments (403 on doctors/slots) | Blocker  | Needs backend; admin stopgap available |
| CORE-04   | No platform endpoint to re-send the first-admin invitation    | High     | Needs backend                          |
| ROLE-01   | Only admins can refund cash at the desk                       | Medium   | Product decision on role templates     |
| CORE-03-B | Go-live does not open the hospital to patients atomically     | Medium   | Web app works around it (2 calls)      |
| ENV-01    | Email links are relative when the frontend URLs are unset     | High     | Deployment setting                     |
| SCHEMA-01 | `schema.yml` documents paginated lists as bare arrays         | Medium   | Web app fixed (CORE-01)                |
| ENV-02    | Test backend signs file links for an unreachable host         | Medium   | Blocks end-to-end download testing     |
| API-01    | No way to read a hospital's commission history                | Low      | Future-dated rates are invisible       |

## CORE-07 — Receptionists cannot book appointments

**New finding; not in the original checklist.**

**What fails.** A receptionist opens New Appointment and the Consultations section shows
"You do not have permission to perform this action." No doctor or slot can be chosen,
so the front desk cannot book a walk-in in the app. The receptionist dashboard shows
"Departments could not be loaded", and the Appointments list's department and doctor
filters fail the same way.

**Evidence.**

- `GET /hospital/doctors`, `GET /hospital/departments` and `GET /hospital/slots` require
  `doctors_departments.view` (backend: `catalog/views/hospital_doctor_list.py:17`,
  `catalog/views/hospital_department_list.py:16`,
  `scheduling/views/hospital_slot_list.py:17`).
- The receptionist role template does not grant it (backend: `core/seeds/v1.py:73-86`).
  The live receptionist session on the test backend confirms this: its permissions are
  appointments, patients, token management, payments, cash desk, dashboard and reports
  only.
- All three endpoints answer 403 for the receptionist. There is no other endpoint that
  lists doctors, departments or slots for desk booking.

**What the backend needs (pick one).**

1. Add `doctors_departments.view` to the receptionist and department-front-desk role
   templates, and migrate existing hospitals' roles. This is the smallest change; read
   access to the doctor list is harmless for the front desk.
2. Or let these three `GET` endpoints accept `appointments.add` as an alternative to
   `doctors_departments.view`, so booking does not depend on a catalogue permission.

**Stopgap without a backend release.** A hospital admin can open Users & Roles,
select Receptionist, and tick Doctors & Departments → View. Only the admin role's grid
is locked (backend: `rbac/services/role_admin.py:55`). Every hospital would have to do
this by hand, so it is not a fix.

## CORE-04 — Ops cannot re-send an expired first-admin invitation

**What fails.** Onboarding a hospital invites its first administrator. The invitation
expires after 7 days (backend: `rbac/services/invitations.py:31`). If the administrator
misses it, nobody can sign in to the hospital, so nobody can re-invite them, and go-live
stays blocked by `no_admin_accepted`.

**Evidence.** The only re-send endpoint is
`POST /hospital/staff/invitations/{id}/resend`. It needs `users_roles.add` inside the
hospital, which means an administrator who has already accepted. The platform API has no
equivalent.

**What the backend needs.**
`POST /platform/hospitals/{id}/admin-invitation`, which:

- re-issues the pending admin invitation with a fresh 7-day expiry;
- optionally takes a corrected email address;
- is audited;
- is refused once an administrator has accepted.

The onboarding screen will add a "Re-send invitation" action next to the administrator
status as soon as this endpoint exists.

## ROLE-01 — Only admins can refund cash at the desk

**What fails.** A cash refund is paid out of the refunding staff member's own open cash
drawer (backend: `payments/services/refunds.py:91-96`) and needs `payments.del`
(backend: `payments/views/hospital_appointment_refunds.py:16`). In the seeded roles:

- receptionists have `payments.view` and `payments.add` only, so they cannot refund at
  all (backend: `core/seeds/v1.py:82`);
- accountants can refund but have `cash_desk.view` only, so they cannot open a drawer
  and every cash refund fails with `CASH_SESSION_REQUIRED` (backend:
  `core/seeds/v1.py:94-95`).

Only an admin, with their own open drawer, can hand back cash. A front desk with no
admin present cannot refund a cash payment.

**What the backend needs.** A product decision on who hands back cash: give
receptionists a refund permission, or give accountants `cash_desk.add` and
`cash_desk.edit`. Then update the role templates and migrate existing hospitals. The web
app shows Refund to staff with the permission and, if their drawer is closed, tells them
to open it first.

## CORE-03-B — Go-live does not open the hospital to patients

**What fails.** `POST /platform/hospitals/{id}/go-live` changes only the status. New
hospitals default to `app_visibility = hidden` and `online_booking_enabled = false`
(backend: `hospitals/models/hospital.py:68-69`). Online booking requires all three:
active, visible and booking on (backend: `appointments/services/booking.py:30-37`). A
hospital taken live in the console therefore stays invisible to patients. The dev seed
sets the flags directly, which is why this never showed in development.

**What the web app now does.**

- The go-live dialog has an "Open to patients now" switch, on by default.
- After go-live succeeds, the app calls `set-visibility` and then
  `PATCH online_booking_enabled` with the returned version.
- The hospital page has separate switches for both flags.

The two follow-up calls are not atomic with go-live. If they fail, the hospital is live
but hidden, and the toast tells ops to finish from the hospital page.

**What the backend should do.** Accept
`{"app_visibility": "visible", "online_booking_enabled": true}` on go-live and apply
them in the same transaction. Product also needs to decide whether going live should
list the hospital by default. The web app assumes yes, with an opt-out for soft
launches.

## ENV-01 — Email links need the frontend URLs set

**What fails.** Invitations, password resets and report downloads are emailed as
`{FRONTEND_HOSPITAL_URL}/…` and `{FRONTEND_PLATFORM_URL}/…` (backend:
`messaging/services/context.py:83-86`). Both settings default to an empty string
(backend: `settings/base.py:236-237`). If unset, every emailed link is a bare path that
opens nothing.

**What the backend needs.**

- Set both settings in every environment. One web app serves both consoles, so
  `FRONTEND_PLATFORM_URL` must be `<app origin>/ops` (see `src/app/router/paths.ts`).
- Refuse to start in production when either setting is empty.

## SCHEMA-01 — `schema.yml` says paginated lists are arrays

**What fails.** These operations return the standard page envelope
`{results, page, page_size, total, has_next}`, but `schema.yml` documents their `200` as
a bare array:

- `hospital_bank_accounts_list` (`GET /hospital/billing/bank-accounts`)
- `hospital_holidays_list` (`GET /hospital/holidays`)
- `hospital_banners_list` (`GET /hospital/banners`)
- `platform_config_document_requirements_list`
  (`GET /platform/onboarding/document-requirements`)
- `hospital_auth_sessions_list` and `platform_auth_sessions_list` (`GET …/auth/sessions`)

The web app followed the schema, and five screens failed to load against the real
backend. That is fixed (CORE-01): all five now read every page of the envelope.
`GET /hospital/hours` really is a bare array; its schema is correct.

**What the backend needs.** Annotate these views with the paginated serializer so the
generated schema matches the responses, and add a schema-vs-response contract test. The
detail and update responses of `/platform/hospitals/{id}` are also untyped
(`responses={200: dict}`).

## ENV-02 — The test backend signs file links for a fake host

**What fails.** `GET /shared/files/{id}/url` on the shared test backend returns links to
`storage.fake.local`, which browsers cannot reach. No download can complete end to end
there: KYC scans, receipts, or the new report-download page. The report-download page
was verified by answering that host from the test browser, the way real object storage
would.

**What the backend needs.** Point the test environment at a reachable object store, for
example MinIO, that sends `Content-Disposition: attachment` on signed GETs.

## API-01 — Commission history cannot be read

**What fails.** `set-commission` appends to an append-only history, and a future-dated
rate takes effect on its day (backend: `hospitals/services/platform_hospitals.py:351`).
No endpoint reads that history. The hospital page can only show the current rate, so a
scheduled change is invisible until it applies.

**What the backend needs.** `GET /platform/hospitals/{id}/commission-history`, newest
first. The Commercial Terms card will list upcoming and past rates.
