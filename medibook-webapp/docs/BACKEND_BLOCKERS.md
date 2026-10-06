# Backend blockers for go-live

Issues from the go-live checklist that the web app cannot fix on its own, plus
related backend and environment gaps found while fixing the rest.
Each entry says what fails, the evidence, what the backend needs to change, and what
the web app does in the meantime.

Found on 6 Oct 2026 against the shared test backend while fixing the Day-one
workflows (`claude/core-day-one`) and the release items (`claude/rel-sec-hardening`).
Paths under `backend:` are in the Django repository.

## Summary

| ID        | Problem                                                       | Severity | Web app status                         |
| --------- | ------------------------------------------------------------- | -------- | -------------------------------------- |
| CORE-07   | Receptionists cannot book appointments (403 on doctors/slots) | Blocker  | Needs backend; admin stopgap available |
| ENV-03    | No resettable staging backend for end-to-end tests and UAT    | High     | Read-only smoke tests only             |
| SEC-04    | No multi-factor sign-in (MFA endpoints answer 501)            | High     | Needs backend and a product decision   |
| SEC-07-B  | Token refresh shares the per-address sign-in limit            | High     | App retries once after `Retry-After`   |
| SEC-01-B  | Background polls keep a server session from going idle        | Medium   | App signs idle tabs out itself         |
| SEC-06-B  | Reusing a just-rotated refresh token revokes the session      | Medium   | App coordinates refresh across tabs    |
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
so the front desk cannot book a walk-in in the app. The browser smoke tests
(`npm run e2e`) find the same 403s on five receptionist screens:

- New Appointment: no doctors or slots to choose;
- Dashboard: "Departments could not be loaded";
- Token Management: the queue does not load ("didn't load");
- Appointments and Payments: the department and doctor filters fail.

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

## ENV-03 — No resettable staging backend for end-to-end tests and UAT

**What fails.** The browser smoke tests and the API contract recorder only read.
The flows the checklist wants tested end to end — walk-in booking, payment with
receipt, refund, the token queue and go-live — all write, and the only backend
available is shared by everyone testing, so automated runs would pile up records
(and go-live cannot be undone). The shared backend is also not reachable from
GitHub Actions, so the smoke tests cannot run in CI.

**What is needed (DevOps + backend).**

- A staging backend with a seed command that resets it to a known state, and a
  public (or VPN-reachable) URL CI can use.
- Accounts for one hospital admin, one receptionist and one platform owner, given to
  CI as repository variables (`E2E_*`) and a secret (`E2E_PASSWORD`).
- Real object storage there (see ENV-02), so downloads complete.

Until then the smoke job in `.github/workflows/ci.yml` stays skipped, and UAT
(`docs/UAT_SCRIPTS.md`) cannot start.

## SEC-04 — No multi-factor sign-in

**What fails.** `MFA_ENABLED` is false and the MFA endpoints are stubs that answer 501
(backend: `settings/base.py:177`, `accounts/views/mfa_not_enabled.py`). The operations
console can act on every hospital and every patient account with a password alone.

**What is needed.** TOTP enrolment and verification for platform staff, and ideally
hospital admins, then the web app's enrolment and sign-in steps. If MFA does not ship
before go-live, a named owner signs a written risk acceptance.

## SEC-07-B — Token refresh shares the per-address sign-in limit

**What fails.** Sign-in, refresh and password reset share a limit of 10 a minute per IP
address (backend: `core/ratelimit.py:34`), and a hospital usually reaches the internet
through one address. At shift change, staff refreshing and signing in together get
429s.

**What the web app now does.** A rate-limited refresh no longer ends the session: the
app waits for `Retry-After` (up to 10 seconds) and tries once more; if that is also
limited, the user's action fails with "Too many attempts" and they stay signed in.

**What the backend should do.** Exempt refresh from the per-address limit (it is
already limited per session family, `accounts/views/token_refresh.py`), or raise it
well above a hospital's staff count.

## SEC-01-B — Background polls keep server sessions alive

**What fails.** Any authenticated request moves the session's last-seen time forward
(backend: `accounts/authentication.py:76-80`). The dashboard and token queue poll every
60 seconds, so the server's 15-minute idle limit never ends a session left open on a
front-desk screen.

**What the web app now does.** Both consoles sign themselves out after 15 minutes with
no keyboard, mouse or touch input, whatever the polls do, after a one-minute warning.

**What the backend should do.**

- Do not count background polls as activity: for example, skip the last-seen update for
  requests marked with a header such as `X-Background-Poll: 1`, which the app can send.
- Expose `session_timeout_min` to hospital staff (on `/hospital/me` or the app config).
  The hospital app cannot read it today and uses the default of 15 minutes.

## SEC-06-B — Reusing a just-rotated refresh token revokes the session

**What fails.** A refresh token is single-use. If a second request arrives with the token
that was just rotated out, the backend revokes the whole session family as a stolen
token (backend: `accounts/services/sessions.py:107-111`). Duplicated or restored tabs
used to do exactly that and sign the user out.

**What the web app now does.** Tabs take turns to refresh (Web Locks), share every
rotation over a BroadcastChannel, and adopt the new pair instead of refreshing again.
Verified: two restored tabs refreshing at once used to end on the sign-in page; both now
stay signed in.

**What the backend should do.** Allow a short grace window (for example 30 seconds) in
which the just-rotated token returns the same new pair instead of revoking. That covers
browsers without these APIs and a message lost between tabs.

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
backend. `GET /shared/app-config` is typed only as `object`; its `legal_versions`
values turned out to be integers, which the app read as strings, so Help & Support
showed a placeholder phone number (fixed in the app; found by the new contract
tests). That is fixed (CORE-01): all five now read every page of the envelope.
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
