# Backend blockers for go-live

Issues from the go-live checklist that the web app cannot fix on its own, plus
related backend and environment gaps found while fixing the rest.
Each entry says what fails, the evidence, what the backend needs to change, and what
the web app does in the meantime.

Found on 6 Oct 2026 against the shared test backend while fixing the Day-one
workflows (`claude/core-day-one`), the release and security items
(`claude/rel-sec-hardening`), the patient-data, money and reliability items
(`claude/privacy-data-runtime`), and the hosting, monitoring, accessibility,
performance and product items (`claude/go-live-remaining`).
Paths under `backend:` are in the Django repository.

## Summary

| ID        | Problem                                                                    | Severity | Web app status                                |
| --------- | -------------------------------------------------------------------------- | -------- | --------------------------------------------- |
| CORE-07   | Receptionists cannot book appointments (403 on doctors/slots)              | Blocker  | Needs backend; admin stopgap available        |
| ENV-03    | No resettable staging backend for end-to-end tests and UAT                 | High     | Read-only smoke tests only                    |
| SEC-04    | No multi-factor sign-in (MFA endpoints answer 501)                         | High     | Needs backend and a product decision          |
| SEC-07-B  | Token refresh shares the per-address sign-in limit                         | High     | App retries once after `Retry-After`          |
| SEC-01-B  | Background polls keep a server session from going idle                     | Medium   | App signs idle tabs out itself                |
| SEC-06-B  | Reusing a just-rotated refresh token revokes the session                   | Medium   | App coordinates refresh across tabs           |
| CORE-04   | No platform endpoint to re-send the first-admin invitation                 | High     | Needs backend                                 |
| ROLE-01   | Only admins can refund cash at the desk                                    | Medium   | Product decision on role templates            |
| CORE-03-B | Go-live does not open the hospital to patients atomically                  | Medium   | Web app works around it (2 calls)             |
| ENV-01    | Email links are relative when the frontend URLs are unset                  | High     | Deployment setting                            |
| SCHEMA-01 | `schema.yml` documents paginated lists as bare arrays                      | Medium   | Web app fixed (CORE-01)                       |
| ENV-02    | Test backend's file storage is fake: no upload or download can complete    | High     | Blocks photos, logos, KYC and downloads       |
| API-01    | No way to read a hospital's commission history                             | Low      | Future-dated rates are invisible              |
| DASH-01   | Admin dashboard counts cancelled bookings as appointments                  | Medium   | Web app subtracts them; walk-ins can't        |
| DASH-02   | Refunds are not split by channel or payment method                         | Medium   | Front desk shows refunds separately           |
| DASH-03   | No server-side read state for hospital notifications                       | Low      | Items stay highlighted until the work is done |
| APPT-01   | A refunded walk-in stays scheduled and can check in unpaid                 | High     | Desk must collect again before check-in       |
| APPT-02   | Cancelled unpaid bookings keep payment status "pending"                    | Low      | Shown as "Not paid"                           |
| APPT-03   | No per-hospital list of accepted desk payment methods                      | Low      | Fixed list: cash, UPI, card, POS, other       |
| APPT-04   | Appointment history names no actor                                         | Low      | Shows patient / staff / system only           |
| APPT-05   | The desk cannot preview a walk-in's real fee before booking                | Medium   | Shows standard and follow-up fee              |
| APPT-06   | Desk staff cannot read services, so no service can be booked               | Medium   | Bookings use the doctor's fee only            |
| APPT-07   | A cancelled appointment keeps the token it gave up                         | Medium   | Patients history hides it on cancelled rows   |
| PAT-01    | The patient list carries no visit count                                    | Low      | One extra request per row                     |
| TOK-01    | Desk roles cannot read the expected consultation time                      | Low      | Falls back to 20 minutes for them             |
| TOK-02    | A session snapshot does not list its queue                                 | Medium   | Queue rebuilt from the appointment list       |
| PAY-02    | Refunding one consultation of a visit refunds the whole visit              | High     | Desk collects per consultation                |
| PAY-01    | Payments cannot be filtered by source (desk / online)                      | Low      | Source filters the visible page only          |
| SET-01    | A paid period's net payable differs from its own ledger                    | High     | Drawer flags the gap                          |
| SET-02    | Statement PDFs are served by a redirect to file storage                    | Low      | Stored copy used; storage needs CORS          |
| DOC-01    | Hospitals can't read their doctors' patient reviews                        | Low      | Average and count only                        |
| SLOT-01   | The patient app's default date range stops a day before the booking window | Low      | Desk grid follows the settings                |
| SVC-01    | Switching a tax rate off doesn't stop it being charged on services         | Medium   | Screen shows it as still charged              |
| USR-01    | Expired staff invitations still read as `invited`                          | Low      | Screen checks `expires_at`                    |
| USR-02    | No OTP invite, admin-set password, or role description                     | Low      | Options shown disabled                        |
| PHI-01-B  | Reads, exports and downloads are not audited; nothing expires              | High     | Needs backend and a DPDP assessment           |
| PHI-06-B  | SMS and WhatsApp templates are not registered                              | High     | Needs DLT and WhatsApp approval               |
| PHI-03-B  | The message outbox export is built in the browser, unaudited               | Medium   | Admin-only; needs a server export             |
| PHI-05-B  | Seeded test hospitals copy real hospitals' names and places                | Medium   | Committed fixtures scrubbed                   |
| PHI-07-B  | Patient search terms travel in the URL (`?q=`)                             | Low      | MRNs out of URLs; search needs backend        |
| DATA-01-B | The server's invoice document prints the UTC issue date                    | Medium   | App shows the IST date                        |
| DATA-05-B | `schema.yml` omits the required `If-Match` on department edits             | Low      | App now sends it                              |
| RUN-07-B  | Live-update sockets check sign-in only when they connect                   | Medium   | App closes sockets on sign-out                |
| RUN-09-B  | Token-queue load at peak is untested                                       | Medium   | App refetches less; test needs ENV-03         |
| DEP-01-B  | Hosting is not set up or checked on staging                                | Blocker  | Guide, nginx config and checker ready         |
| DEP-02-B  | The browser cannot call the API from another origin                        | Blocker  | Same-origin layout ready; or set CORS         |
| DEP-03-B  | File storage has no public HTTPS host                                      | Blocker  | Needs DevOps; CSP takes the host              |
| DEP-04-B  | The bucket does not allow browser uploads (CORS)                           | High     | Rule in `docs/DEPLOYMENT.md`                  |
| DEP-06-B  | Production providers and settings are unconfirmed                          | High     | Needs backend and DevOps                      |
| DEP-07-B  | Nothing checks that email can be sent                                      | High     | Needs backend; link bases are ENV-01          |
| DEP-09-B  | Backups and restores are unconfirmed                                       | High     | Needs DevOps                                  |
| DEP-12-B  | Rate limits may see the proxy's address, not the client's                  | Medium   | Proxy settings documented                     |
| OBS-01-B  | No error monitor receives the app's reports yet                            | High     | Reports ready; needs an endpoint              |
| OBS-05-B  | Nothing alerts when the web app or its WebSocket route is down             | Medium   | Probes and rules in `deploy/monitoring`       |
| OBS-02-B  | Tickets lack the requester's name; staff cannot self-assign                | Medium   | Inbox works around both                       |
| OBS-06-B  | App config has a support phone but no support email                        | Low      | App shows only what is configured             |
| PRD-08-B  | Audit rows carry no actor name; one resource type per filter               | Medium   | Names looked up where the role allows         |
| PRD-02-B  | Resolved: `/hospital/me` already carries the logo                          | Low      | Every role sees the hospital's logo           |
| PRD-05-B  | Ops lists lack plan, bookings, city, activity and payout data              | Low      | Columns and tiles left out                    |
| PRD-06-B  | Two receipt settings and the series separator are never used               | Low      | Left out; needs a decision                    |
| PRD-07-B  | The desk cannot get a fee quote before booking                             | Low      | Screen says the booking prices it             |

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

**What fails.** The shared test backend runs the in-process `FakeStorage`
(`integrations/storage/client.py`), whose links all point at `storage.fake.local` — a
host browsers cannot reach, backed by memory inside the backend process.

- **Downloads:** `GET /shared/files/{id}/url` returns such a link, so no download can
  complete: KYC scans, receipts, statements, report downloads. The report-download page
  was verified by answering that host from the test browser, the way real object storage
  would.
- **Uploads** (reported 6 Oct 2026 — a doctor photo would not upload):
  `POST /shared/files/uploads` returns an `upload_url` on that host, so the browser's
  `PUT` of the file fails and `/complete` is never reached. Every upload in the app is
  blocked on this backend: doctor photos, the hospital logo and cover, patient banners,
  KYC documents.

**What the backend needs.** Point the test environment at a reachable object store, for
example MinIO, that accepts presigned `PUT`s from the app's origin (CORS) and sends
`Content-Disposition: attachment` on signed GETs.

**What the web app does meanwhile.** A failed upload says the file store could not be
reached (instead of "check your connection" — the API itself answered); photos that
cannot load fall back to initials.

## API-01 — Commission history cannot be read

**What fails.** `set-commission` appends to an append-only history, and a future-dated
rate takes effect on its day (backend: `hospitals/services/platform_hospitals.py:351`).
No endpoint reads that history. The hospital page can only show the current rate, so a
scheduled change is invisible until it applies.

**What the backend needs.** `GET /platform/hospitals/{id}/commission-history`, newest
first. The Commercial Terms card will list upcoming and past rates.

## DASH-01 — The admin dashboard counts cancelled bookings

**New finding (live check of the hospital dashboard, 6 Oct 2026).**

**What fails.** For the same day the two dashboards disagree. On the test hospital,
`GET /hospital/dashboard/admin?period=today` returned `appointments.total = 13` with
`by_status = {cancelled: 12, scheduled: 1}`, while `GET /hospital/dashboard/reception`
returned `queue_summary.total = 1`. The admin total leaves out only pending-payment
bookings (backend: `analytics/services/dashboard.py:118`); the reception total also
leaves out cancelled ones (backend: `analytics/services/dashboard.py:168`). The admin
department chart and top doctors count live bookings only, so the admin screen
contradicted itself (13 appointments, 1 in the chart).

`appointments.by_source` has the same gap: it counts cancelled bookings (backend:
`analytics/services/dashboard.py:67-69`), so the front desk's "Walk-ins Today" includes
walk-ins that were cancelled, and there is no per-source cancelled count to subtract.

**What the backend needs.** One definition of "appointments" across both dashboards —
excluding cancelled (and pending-payment) bookings — for `appointments.total` and
`appointments.by_source`.

**What the web app does meanwhile.** The admin tile subtracts `by_status.cancelled` from
the total and says how many cancelled bookings it left out. The Walk-ins Today tile cannot
be corrected, so its caption says cancellations are included.

## DASH-02 — Refunds are not split by channel or payment method

**What fails.** `revenue.by_channel` and `revenue.by_method` are gross collections
(captured payments), and `revenue.refunded_paise` is one hospital-wide total (backend:
`analytics/services/dashboard.py:79-90`). The front desk's Today's Collection therefore
cannot show what the desk actually kept. On the test backend it showed ₹500 collected at
the desk for a payment that was refunded in full the same day (net ₹0). Desk payments are
also not split by method within the desk channel, so "UPI / card" at the desk can only be
estimated as desk total minus cash.

**What the backend needs.** Refunds grouped by channel and by method (or net figures per
channel and method), and a per-channel method breakdown, e.g.
`revenue.by_channel_method: {desk: {cash, upi, card, …}, online: {…}}`.

**What the web app does meanwhile.** The desk tiles are labelled as before refunds, the
non-cash tile reads "Desk UPI / Card / Other", and a separate Refunded Today tile shows
the hospital-wide refund total.

## DASH-03 — Hospital notifications have no read state

**What fails.** The topbar bell is built from live counts (dashboard alerts and
settlement periods). The hospital API has no notifications or read-receipt endpoint, so a
"read" state could not be stored: it would not survive a reload or carry over to other
devices or tabs.

**What the backend needs.** Either a hospital notifications feed with read state
(`GET /hospital/notifications`, `POST …/read`), or a per-staff "last seen" timestamp for
the alert counts.

**What the web app does meanwhile.** Every bell item that needs action stays highlighted
until the work behind it is done. There is no "Mark all read" (PRD-04), because reading an
item does not do the work.

## APPT-01 — A refunded walk-in stays scheduled and can be checked in unpaid

**New finding (live check of the Appointments screen, 6 Oct 2026).**

**What fails.** A desk refund on a walk-in whose visit is still on changes only the
payment status: the appointment stays `scheduled` with `payment_status = refunded`
(backend: `payments/services/refunds.py:106-119`). Check-in looks only at the status and
the date, not at payment (backend: `appointments/services/desk.py:164-171`), so the
patient can be checked in and seen after their money was handed back. On the test hospital today
the only live walk-in is in exactly this state, and the screen offered "Check in" for it.

**What the backend needs.** Either cancel the appointment when its payment is refunded
in full while the visit is still on, or refuse check-in for a walk-in that is not paid
(`APPOINTMENT_NOT_ACTIONABLE`).

**What the web app does meanwhile.** A refunded walk-in whose visit is still on counts
as Pending Payment: its action is Collect (the backend accepts a new payment for it), the
drawer explains the refund, and Check in is hidden until it is paid again.

## APPT-02 — Cancelled unpaid bookings keep payment status "pending"

**What fails.** An online booking cancelled before checkout completed keeps
`payment_status = pending` for good. On the test hospital today 12 of 13 appointments are such
cancelled bookings. A desk list reading "Pending ₹…" on them suggests money is still owed.

**What the backend needs.** A terminal payment status for bookings that end without
payment (e.g. `void` or `unpaid`), set when the appointment is cancelled or expires.

**What the web app does meanwhile.** Cancelled and no-show bookings that were never paid
show "Not paid".

## APPT-03 — No per-hospital list of accepted desk payment methods

**What fails.** The desk payment endpoint accepts every method in `Payment.Method`
(backend: `payments/services/desk.py:18`), and no hospital setting says which ones a
hospital takes at the counter. The web app has to decide the list itself.

**What the backend needs.** A hospital setting for accepted desk methods (exposed on
`/hospital/settings` or `/hospital/me`), validated by the desk payment endpoint.

**What the web app does meanwhile.** Collect Payment offers cash, UPI, card, POS (card
machine) and other.

## APPT-04 — Appointment history names no actor

**What fails.** Appointment events carry `actor_kind` and `actor_user_id` only. The desk
cannot see which staff member checked a patient in, cancelled or refunded.

**What the backend needs.** The actor's display name on each event (e.g. `actor_name`),
as patient approvals already do (`requested_by_name`).

**What the web app does meanwhile.** History lists each step with Patient, Hospital
staff or System, and the status change it made.

## APPT-05 — The desk cannot preview a walk-in's real fee

**New finding (live check of New Appointment, 6 Oct 2026).**

**What fails.** A walk-in is priced at booking time by `fees.quote` (backend:
`appointments/services/booking.py:248-255`, `catalog/services/fees.py:179`): follow-up
pricing within `follow_up_window_days`, an optional service, and tax. No hospital
endpoint returns that quote before booking. On the test hospital, 2 of the 12 most recent
walk-ins were follow-ups charged half the doctor's fee (₹450 instead of ₹900), so a
preview built from the doctor's standard fee overstates them by 50%.

**What the backend needs.** A read-only quote for desk bookings, e.g.
`POST /hospital/appointments/quote {patient, consultations[]}` returning per-consultation
fee, follow-up flag, tax and total, using the same `fees.quote`.

**What the web app does meanwhile.** The preview shows the standard fee and, when lower,
the follow-up fee the same doctors would charge; the booked modal then shows the real
totals from the booking.

## APPT-06 — Desk staff cannot read services, so no service can be booked

**What fails.** A walk-in consultation may name a `service_id` (backend:
`appointments/serializers/hospital_walk_in_consultation_serializer.py:9`), and the test hospital has
services linked to doctors (ECG, X-Ray (Knee)). But `GET /hospital/services` and
`GET /hospital/doctor-services` need `hospital_settings.view` (backend:
`catalog/views/hospital_service_list.py:16`,
`catalog/views/hospital_doctor_service_list.py:16`), which receptionists — the people who
book walk-ins — do not have. The desk cannot offer a service, so every walk-in is booked as
a plain consultation.

**What the backend needs.** Read access to active services and doctor–service links for
desk roles (a `services` read under `appointments.add`, or `hospital_settings.view` for
receptionists), alongside CORE-07's doctors and departments.

**What the web app does meanwhile.** New Appointment books consultations without a
service; a service picker can follow once desk roles can read the list.

## APPT-07 — A cancelled appointment keeps the token it gave up

**New finding (live check of Appointments and Patients, 6 Oct 2026).**

**What fails.** Cancelling a booking releases its token for the next booking (the history
shows `token_reassigned`, and a new booking records `token_reused`), but the cancelled
appointment keeps its `token_label` and `token_no`. On the test hospital today, 12 cancelled
appointments all read `A001` — the token now held by someone else — and patients' booking
histories show the same stale tokens.

**What the backend needs.** Clear (or flag as released) `token_label` / `token_no` on an
appointment when its token is released, so no screen can show a token that belongs to
another patient.

**What the web app does meanwhile.** The patient booking history hides the token on
cancelled rows. (The Appointments list still shows it pending a decision.)

## PAT-01 — The patient list carries no visit count

**What fails.** `GET /hospital/patients` returns no count of the patient's visits, so the
list's Visits column makes one `GET /patients/{id}/appointments?status=completed&page_size=1`
per row (8 per page). It worked on the test backend but scales with the page size.

**What the backend needs.** A `completed_visits` count on each list row (or on the patient
serializer).

**What the web app does meanwhile.** One cached count request per row, counting completed
consultations only. Before this fix the column counted every booking, cancelled ones
included (Ishaan Varma showed 1 visit for a cancelled booking).

## TOK-01 — Desk roles cannot read the expected consultation time

**New finding (live check of Token Management, 6 Oct 2026).**

**What fails.** The queue's own notion of a long consultation is the doctor's
`expected_consult_minutes`, falling back to the hospital's (backend:
`tokens/services/queue.py:343-344`, Q29). On the test hospital no doctor sets one, so the hospital
default (10 minutes) applies, but it lives on `GET /hospital/settings`, which needs
`hospital_settings.view` — receptionists, who run the queue, cannot read it.

**What the backend needs.** The effective expected minutes on the session snapshot (e.g.
`expected_minutes`), or the hospital default on `/hospital/me`.

**What the web app does meanwhile.** A call open longer than the doctor's expected time —
else the hospital default for roles that can read settings, else 20 minutes — is flagged.

## TOK-02 — A session snapshot does not list its queue

**What fails.** `GET /hospital/sessions` and the `session.updated` push carry counts and the
current token only (backend: `tokens/services/queue.py:122-149`), not which tokens are
waiting or skipped. The desk's "Up next" and "Skipped" lists have to be rebuilt from
`GET /hospital/appointments` for the day, so they depend on that list being fresh and on
the role being able to read appointments, and they can lag a socket push.

**What the backend needs.** The waiting tokens in call order (token number, label,
patient name, called/skipped flag) on the session snapshot or a
`GET /hospital/sessions/{id}/queue`.

**What the web app does meanwhile.** "Up next" lists the session's un-called waiting
tokens by token number — the same rule `call_next` uses — and "Skipped" lists the ones
already called; both refresh with the appointment list.

## PAY-02 — Refunding one consultation of a visit refunds the whole visit

**New finding (live check of Billing → Payments, 6 Oct 2026).**

**What fails.** A refund — a desk refund or a hospital cancellation — looks for the
appointment's own paid order and, when there is none, the paid order of its **visit**
(backend: `payments/services/refunds.py:27-43`). It then refunds every captured line of that
order. When a visit's consultations are paid together (`POST /visits/{id}/payments`, one
order), cancelling or refunding one consultation hands back the money for all of them,
while the other consultations stay booked and unpaid on paper.

**What the backend needs.** Refunds of one appointment limited to that appointment's
share of a visit order (per-appointment allocation on the order), or refuse a
single-appointment refund on a visit order and offer a visit-level refund instead.

**What the web app does meanwhile.** The desk collects each consultation separately (one
order per appointment), so every refund stays within its own consultation. Visit-level
collection (one payment and one receipt for the visit) can return once this is fixed.

## PAY-01 — Payments cannot be filtered by source

**What fails.** `GET /hospital/payments` filters by date, method, status, doctor,
department and search only (backend: `payments/views/hospital_payment_list.py:14`), not by
channel (desk / online). The Payments screen's Source filter can only narrow the page it
already loaded, so page counts and totals ignore it.

**What the backend needs.** A `channel` filter (`desk` / `online`) on the payment list and
its exports.

**What the web app does meanwhile.** Source filters the visible page and says so.

## SET-01 — A paid period's net payable differs from its own ledger

**New finding (live check of Billing & Settlements, 6 Oct 2026).**

**What fails.** `GET /hospital/settlements/periods/{id}` returns the period's
`net_payable_paise` and a `breakdown` whose `ledger_net_paise` is the sum of its ledger
entries. For the test hospital's August period (paid, payout released, UTR `HDFCN01A0EE2F9F8B`) the
ledger nets to ₹6,889.84 but the period — and the released payout — say ₹6,989.84: ₹100
more, with no adjustment recorded (`adjustments_paise = 0`). The 1–15 Sep period agrees
(₹15,642.47 both ways).

**What the backend needs.** Find where the ₹100 came from (a ledger entry missing from
the breakdown, or a net computed outside the ledger), and keep `net_payable_paise` equal
to `ledger_net_paise + adjustments_paise`, ideally enforced when a period closes.

**What the web app does meanwhile.** The period drawer lists every deduction (including
commission GST and the convenience fees Medibook keeps, which it used to omit — so its
lines never added up) and, when the ledger and the net disagree, says by how much.

## SET-02 — Statement PDFs are served by a redirect to file storage

**What fails.** `GET /hospital/statements/{id}.pdf` answers `302` to a signed storage link
(on the test backend, the unreachable `storage.fake.local` — see ENV-02). The web app
fetches a rendered PDF with a background request, which follows that redirect only if the
storage host allows cross-origin reads (CORS).

**What the backend needs.** Either return the PDF bytes directly, or return
`{url}` (as `/appointments/{id}/receipt.pdf` does) so the app can hand the link to the
browser; and configure CORS on the storage bucket for the app's origin.

**What the web app does meanwhile.** Statements that have a stored PDF (both on
the test hospital) download through the shared files API; the on-demand render is the fallback.

## DOC-01 — Hospitals can't read their doctors' patient reviews

**New finding (live check of Doctors & Departments, 6 Oct 2026).**

**What fails.** Patients submit a review per appointment
(`/patient/appointments/{id}/review`) and Medibook moderates them (`/platform/reviews`),
but no endpoint lists them to the hospital. The hospital API exposes only a doctor's
`rating_avg` and `rating_count` (approved reviews), so the doctor's Reviews tab can show
the average but not what patients wrote.

**What the backend needs.** `GET /hospital/doctors/{id}/reviews` (paginated): approved
reviews only — rating, text, date and the patient's initials — read-only, under `doctors_departments.view`.

**What the web app does meanwhile.** The Reviews tab shows the average and the number
of approved reviews (or the starting rating the app falls back to) and says the
written reviews are moderated by Medibook.

## SLOT-01 — The patient app's default date range stops a day before the booking window

**New finding (live check of Slots & Availability, 6 Oct 2026).**

**What fails.** With `booking_window_days = 30`, three backend answers disagree about the
last bookable date:

- `GET /hospital/settings` → `derived.booking_window_end_date` = **5 Nov** (today + 30);
- slot generation (`materialise`, the nightly run) creates slots up to **5 Nov** — 60 open
  slots on the test hospital that day;
- `GET /patient/doctors/{id}/availability` with no `to` ends at **4 Nov**
  (`start + booking_window_days - 1`), so the patient app never offers 5 Nov unless it
  asks for that date explicitly.

**What the backend needs.** One definition of the window — either "today + N days" or
"N days counting today" — used by settings, slot generation and patient availability.

**What the web app does meanwhile.** Slots & Availability uses
`booking_window_end_date` from settings (it used to compute its own, one day shorter,
and hid the last generated day's slots).

## SVC-01 — Switching a tax rate off doesn't stop it being charged on services

**New finding (live check of Services & Pricing, 6 Oct 2026).**

**What fails.** A service is billed with the one tax rate linked to it
(`services.tax_rate_id`). The fee engine (`catalog/services/fees.py` `quote`) uses that
rate without checking `is_active`, so switching a rate off on the Taxes tab changes
nothing for the services already linked to it — they keep being charged. Meanwhile
saving a service (`catalog/services/medical_services.py`) accepts only an **active**
rate, so re-sending the linked rate after it is switched off is refused
(`VALIDATION_ERROR` on `tax_rate_id`).

**What the backend needs.** Decide what "off" means for a service rate and apply it in
one place: either stop charging it (treat the service as exempt, or refuse to switch
off a rate that services still use and list them), and keep the save rule consistent
with the fee engine.

**What the web app does meanwhile.** Prices are shown as the backend will charge them:
a service on a switched-off rate still shows the tax, marked "rate switched off, still
charged", and the Taxes tab says how many services still use it. Saves no longer
re-send an unchanged rate, so such a service can still be edited or toggled.

## USR-01 — Expired staff invitations still read as `invited`

**New finding (live check of Users & Roles, 6 Oct 2026).**

**What fails.** An invitation's `status` becomes `expired` only when the same email is
invited again (`rbac/services/invitations.py`); nothing sweeps them when `expires_at`
passes. So `GET /hospital/staff/invitations?status=invited` also returns invitations
whose link no longer works — on the test hospital, the receptionist invitation due at 17:21 on
6 Oct keeps reading `invited` after that.

**What the backend needs.** Treat `expires_at <= now` as expired when listing and
filtering (or a periodic job that flips the status), so `status=invited` means the link
still works.

**What the web app does meanwhile.** It works the state out from `expires_at`: such a
row reads "Invite expired", has its own status filter, is not counted as a pending
invite, and its drawer offers Resend (which issues a new link) or Revoke.

## USR-02 — No OTP invite, admin-set password, or role description

**What fails.** The design's Add User and Reset Password flows offer a mobile OTP and an
administrator-set (temporary) password; the backend only emails links
(`POST /staff/invitations`, `POST /staff/{id}/reset-password`). Roles also carry no
description or colour (`RoleSerializer`: id, code, name, flags, permissions), so the
screen's one-line summaries and colours are fixed copy per role code.

**What the backend needs.** If the product wants them: an OTP invite / OTP reset, an
admin-set temporary password with forced change at next sign-in, and a `description`
on roles.

**What the web app does meanwhile.** The OTP and set-a-password options are shown but
disabled with an explanation; the email link is the only method that works. Role
descriptions and colours are presentation copy.

## PHI-01-B — Reads, exports and downloads are not audited; nothing expires

**What fails.** Every successful write leaves an audit row, but safe methods are
skipped (backend: `core/api.py:98-125`), so opening a patient, exporting a list or
downloading a file leaves no trace. The retention sweep only records what is due for
archival and never deletes (backend: `audit/tasks.py:20-25`, Q122).

**Why it matters.** The DPDP Act 2023 assessment (checklist PHI-01) has to show who
read or exported personal data, and how long each kind of data is kept.

**What the backend should do.** Audit reads of patient records and every export and
file download (actor, record or filter, time). Agree retention periods with
compliance, then make the sweep delete or anonymise after them. The web app needs
no change for either.

## PHI-03-B — The message outbox export is built in the browser

**What fails.** Messaging → Send & Outbox → Export CSV pages through
`GET /hospital/messaging/deliveries` in the browser and writes the file there. On the
test backend that was 9 requests and 820 rows of patients' phone numbers and email
addresses, with no audit row (6 Oct). Only admins can open Messaging, and listing
deliveries needs `hospital_settings.view`.

**What the backend should do.** Add a server-side export (for example
`GET /hospital/messaging/deliveries/export?format=csv` with the list's filters) that
requires a permission, guards spreadsheet formulas like the settlement export, and
writes an audit row with the actor and the filters. The web app then switches the
button to it.

**Meanwhile.** Every CSV the web app builds now neutralises spreadsheet formulas
(PHI-04).

## PHI-05-B — Seeded test hospitals copy real hospitals

**What fails.** The test backend's seed names hospitals after real ones: one
seeded hospital's name and street address match a real hospital in Kochi, and another
echoes a real hospital chain in Pune. The names reach every screenshot, demo and
recorded fixture. (They are not repeated here, for the same reason.)

**What the backend should do.** Rename the seeded hospitals, companies, street
addresses and email domains to clearly fictional ones.

**Meanwhile.** The fixture recorder replaces these names, street addresses and exact
coordinates before writing, and the committed fixtures are scrubbed
(`node scripts/record-api-fixtures.mjs --rescrub`). Each seeded hospital also has a
three-letter code that starts its booking, MRN and receipt numbers, staff codes and
registration number; the recorder now replaces those codes too (PRD-06). Fixtures in
earlier commits still carry them, so the git history needs a decision if that matters.

## PHI-06-B — SMS and WhatsApp templates are not registered

**What fails.** Every SMS must carry a DLT template id registered with the operator,
set per event in `MSG91_DLT_TEMPLATE_IDS`; the operator permanently rejects an
unregistered one (backend: `integrations/msg91/client.py:1-37`). WhatsApp business
messages need approved templates as well. Until both are registered, patients get no
confirmation or reminder by SMS or WhatsApp.

**What is needed.** Register every patient-facing template (confirmation, reminder,
cancellation, refund, one-time code) on the DLT portal and with WhatsApp, set the ids
in production configuration, and check on staging that one appointment confirmation
arrives by SMS, WhatsApp and email.

## PHI-07-B — Patient search terms travel in the URL

**What fails.** Patient search sends what staff type (names, phone numbers, MR
numbers) as `GET /hospital/patients?q=…`, so it lands in proxy and server access logs.

**What the web app now does.** Patient pages use the record id instead of the MR
number, and opening a patient reads `/patients/{id}` without a search. Old MR-number
links still work and are replaced by the record-id address.

**What is needed.** Either the backend accepts the search in a POST body, or the
reverse proxy leaves query strings out of access-log lines for
`/api/v1/hospital/patients`. Confirm with a production log sample.

## DATA-01-B — The server's invoice document prints the UTC issue date

**What fails.** The invoice HTML/PDF prints `inv.issued_at.date()`, which is the UTC date
(backend: `subscriptions/services/invoicing.py:272-273`). Invoices are generated at 00:30
IST, the previous day in UTC, so every scheduled invoice document shows the day before
its real issue date.

**What the backend should do.** Convert to India Standard Time (or the hospital's zone)
before taking the date, in the document and in any server-side CSV.

**Meanwhile.** The web app shows and prints the IST date, and writes it to its own CSVs
(DATA-01): the invoice issued at 00:30 IST on 3 Oct now reads "Issued 03 Oct 2026".

## DATA-05-B — `schema.yml` does not say department edits need `If-Match`

**What fails.** `PATCH /hospital/departments/{id}` refuses an edit without `If-Match`
(backend: `catalog/services/departments.py:35`, `require_version`), but `schema.yml` does
not list the header. The web app did not send it, so every department edit failed with
400 "If-Match: This header is required" (confirmed 6 Oct). Holiday edits failed the same
way; for those the contract does document the header.

**What the backend should do.** Document `If-Match` on the department PATCH, and check
every other PATCH that calls `require_version` for the same gap.

**Meanwhile.** The web app now sends `If-Match` on department and holiday edits, and on
leave, date-exception, tax-rate and coupon deletes (DATA-05).

## RUN-07-B — Live-update sockets check sign-in only when they connect

**What fails.** The socket consumers authorise the token once, at connect
(backend: `core/ws.py:36-46`). A session revoked afterwards (sign-out everywhere, a
blocked account) keeps receiving pushes until the socket drops. A bad token is
refused by closing before accepting, which browsers report only as an abnormal close
(1006), so a client cannot tell "signed out" from "network down".

**What the backend should do.** Accept, then close with 4401 when the token is bad,
and close a session's sockets when the session is revoked (or re-check the session on
each push).

**What the web app now does.** It closes every socket when its session ends in any
tab, drops a line that stops answering pings, and after repeated refusals refreshes
the token once and then shows "Live updates off" instead of reconnecting forever
(RUN-07).

## RUN-09-B — Token-queue load at peak is untested

**What fails.** Every queue push reaches every open terminal, and each terminal used to
refetch every page of every cached appointment list per push, so load grew with
terminals × pages × token calls.

**What the web app now does.** A push refreshes only lists that include today, at most
once per two-second burst, and only the lists on screen (RUN-09).

**What is needed.** A load test on staging (ENV-03): ten terminals and fifty doctors
calling tokens at peak, with API response times and rate limits measured. Pushes that
carry the changed appointment would let terminals update without refetching at all.

## DEP-01-B — Hosting is not set up or checked on staging

**What is missing.** Nothing has hosted the built app yet. The web app now ships the
guide (`docs/DEPLOYMENT.md`), a reference nginx config (`deploy/nginx/`) and a checker
(`scripts/check-deployment.sh`). The build refuses to run without explicit API and
WebSocket origins (DEP-10), and the app refuses to start over plain http (DEP-05).

**What DevOps needs to do.** Host a staging build by the guide, then:

- run `scripts/check-deployment.sh https://<staging host>` until every check passes
  (https redirect, security headers, deep links, caching, compression, the 404 for a
  missing bundle, and the API);
- book an appointment and record a payment over https (DEP-05);
- call a token on one terminal and see it on another within two seconds (DEP-11): the
  `/ws/` route needs the upgrade headers and a read timeout over 5 minutes.

## DEP-02-B — The browser cannot call the API from another origin

**What fails.** All three CORS allowlists default to empty (backend:
`settings/base.py:192-196`) and origins must match exactly (backend: `core/cors.py`).
From any other origin, every browser call is blocked.

**What is needed.** One of:

- **Same origin (recommended).** Serve `/api` and `/ws` from the app's own host, as
  `deploy/nginx/medibook-web.conf` does, and build with `VITE_API_BASE_URL=same-origin`
  and `VITE_WS_BASE_URL=same-origin`. No CORS settings are needed.
- **Another origin.** Set `CORS_ORIGINS_HOSPITAL` and `CORS_ORIGINS_PLATFORM` to the app
  origin (one app serves both consoles), allowing `Authorization`, `If-Match` and
  `Idempotency-Key` and exposing `Content-Disposition` (report downloads read the file
  name from it).

## DEP-03-B — File storage has no public HTTPS host

**What fails.** Signed upload and download links are signed for `S3_ENDPOINT` (backend:
`integrations/storage/client.py:81-94`). Docker Compose sets it to the internal
plain-http MinIO address, which browsers outside the server network cannot reach.
Logos, banners, KYC scans and receipt PDFs all depend on it. The MinIO community
edition used in Compose is archived. The test backend's version of this is ENV-02.

**What is needed.** A storage endpoint browsers reach over https (S3, or a maintained
S3-compatible store behind TLS). Build the app with that origin as
`VITE_STORAGE_ORIGIN`, so the Content-Security-Policy allows it and downloads from
any other host are refused.

## DEP-04-B — The bucket does not allow browser uploads

**What fails.** Uploads are a cross-origin `PUT` from the app origin with
`Content-Type` and `x-amz-checksum-sha256` headers (backend:
`integrations/storage/client.py:102-117`; `src/core/api/files.api.ts`). Without a
bucket CORS rule the browser's preflight fails.

**What is needed.** The bucket CORS rule in `docs/DEPLOYMENT.md` §4, with the
production app origin.

## DEP-06-B — Production providers and settings are unconfirmed

**What fails.** `ENVIRONMENT` defaults to `dev` (backend: `settings/base.py:14`), and
fake providers are refused only in `prod` (backend: `integrations/http.py:55-59`); fake
storage hands out `storage.fake.local` links. Receipt PDFs answer 501 unless the PDF
renderer is installed (backend: `payments/services/pdf.py:24-36`). `ALLOWED_HOSTS`
defaults to localhost.

**What is needed.** Staging and production run with `ENVIRONMENT=prod`, live Razorpay
keys, the PDF renderer installed and `ALLOWED_HOSTS` naming the API host. Proof: a
live-mode payment test passes and a receipt PDF downloads on staging.

## DEP-07-B — Nothing checks that email can be sent

**What fails.** Nothing checks the email settings at start-up. With the SES
credentials missing, each send is refused by SES and the request is non-critical
(backend: `integrations/ses/client.py:21-53`), so invitations and password resets do
not arrive and nothing says why. Email link bases are covered by ENV-01.

**What is needed.** A start-up check in production for the SES settings and the link
bases, and a delivery test on staging: an invitation and a password reset arrive, and
their links open the right screens.

## DEP-09-B — Backups and restores are unconfirmed

**What is missing.** The backend ships Postgres backup and restore scripts and an
off-site copy (backend: `deploy/postgres/`), but nothing records that they run in
production or that a restore has worked. Uploaded files in object storage need their
own backup.

**What is needed.** Restore last night's database and file storage into staging and
record how long it took.

## DEP-12-B — Rate limits may see the proxy's address, not the client's

**What fails.** The backend trusts `X-Forwarded-For` only from `TRUSTED_PROXY_CIDRS`
(backend: `core/net.py:20-30`; default `127.0.0.1/32`), and its nginx limits requests
per connecting address (backend: `deploy/nginx/nginx.conf:7`). Behind a CDN, a load
balancer or the web app's own proxy, every user would share one limit, and a few busy
terminals could lock everyone out of sign-in.

**What is needed.** List every proxy in front of the API in `TRUSTED_PROXY_CIDRS`, and
give the backend's nginx `set_real_ip_from` and `real_ip_header X-Forwarded-For` for
them. Proof: two users on different networks get separate limits in production.

## OBS-01-B — No error monitor receives the app's reports yet

**What is missing.** The web app now reports crashes, uncaught errors, server errors
and unreadable responses, each with the screen path, release, commit and request id
(`docs/MONITORING.md`). Nothing receives them until a monitor is chosen.

**What is needed.** DevOps picks the endpoint (a log collector's HTTP input or a
monitoring service that accepts JSON), allows the app origin in its CORS settings, and
builds with `VITE_MONITORING_URL`. Source maps are built with `BUILD_SOURCEMAPS=hidden`
and uploaded to the monitor, never to the web server. Proof: a forced render error and a
forced 500 on staging both reach it.

## OBS-05-B — Nothing alerts when the web app or its WebSocket route is down

**What is missing.** The backend's Prometheus watches the API only. The web repo now
ships blackbox probes, scrape jobs and alert rules for the app's page, a static file and
the `/ws/` route (`deploy/monitoring/`, tests pass with `promtool`).

**What is needed.** Run blackbox_exporter beside the backend's Prometheus, add the jobs
and rules, then on staging stop the web server and the WebSocket route in turn: each must
page the on-call person within five minutes.

## OBS-02-B — Tickets lack the requester's name; staff cannot self-assign

**What fails.** Platform ticket rows carry `raised_by_id` and `hospital_id` but no names
(backend: `support/services/tickets.py` `serialize`), so the inbox looks up each hospital
separately and can name the person who raised a ticket only once they post a message.
`GET /platform/me` has no staff id, and the staff list needs `staff.view`, which only the
Owner role holds, so the Operations Manager and Support roles cannot assign a ticket to
anyone, themselves included. Sorting by `priority` is alphabetical.

**What the web app does.** It resolves hospital names through the hospital record, shows
the assignee picker only to roles with `staff.view` and a read-only value to others, and
offers no priority sort.

**What the backend needs.** Add the requester's name and email, the hospital name and the
assignee's name to ticket rows; add the caller's staff id to `/platform/me` (or accept
`me` as `assigned_to_id`); sort priority by severity.

## OBS-06-B — App config has a support phone but no support email

**What fails.** `GET /shared/app-config` returns `support_contacts.phone_e164` from Platform
Settings, and nothing else. The app showed two different hard-coded addresses and a
number that dialled a different line (OBS-06).

**What the web app does.** It shows only what app config sends: today, the phone. It
already reads `support_contacts.email` and shows it as soon as the backend sends it.

**What is needed.** Send the support email (backend setting `PLATFORM_SUPPORT_EMAIL`, or a
Platform Settings field) in `support_contacts`, and set the real support phone in Platform
Settings before go-live.

## PRD-08-B — Audit rows carry no actor name; one resource type per filter

**What fails.** Audit rows return `actor_user_id` and `principal` only (backend:
`audit/serializers/audit_log_serializer.py`). The roles that read the logs (Operations
Manager, Support, Compliance) cannot list Medibook staff, because `staff.view` is
Owner-only, and no platform endpoint names a hospital's staff member. `resource_type`
filters one exact value, and request rows name a view class (`PlatformLoginView`), so a
"module" filter would need one request per type. No severity is recorded, and refused
requests are not recorded at all (backend: `core/api.py` `_audit_mutation` skips status
400 and above).

**What the web app does.** Names Medibook staff for roles that can list them, patients
through their account, and hospital staff by their hospital, with the id's last eight
characters otherwise. It filters by who acted, by one person picked from a row, and by
one resource type from a menu of the types services record. The made-up severity column
is gone.

**What the backend needs.** Store the actor's name and role on each row when it is
written; accept a comma-separated `resource_type` (or add a `module` column); decide
whether refused attempts other than sign-ins belong in the trail.

## PRD-02-B — Only Hospital Settings roles can see the hospital's logo (resolved)

**Resolved.** `/hospital/me` already returns `logo_file_id` in its `hospital` object
(backend `accounts/views/hospital_me.py`), so the sidebar now reads the logo from the
session for every role and falls back to the Medibook mark when there is none or its link
fails. Nothing is needed from the backend. Showing a real logo end to end is still
untested while the test backend's file storage is fake (ENV-02).

## PRD-05-B — Ops lists lack plan, bookings, city, activity and payout data

**What fails.** These showed as columns and tiles that were always "—":

- Hospitals: list rows have no plan or monthly bookings (backend:
  `hospitals/serializers/platform_hospital_serializer.py`).
- Platform Users: patient accounts have no city or booking count, and the list filters
  only by status and search, so monthly-active and new-this-week counts cannot be made
  (backend: `platform/views/users_list.py`).
- Hospital profile in ops: no payout account or payment grace; payouts carry only the
  account's last four digits.
- Ops Users: two-factor status, which is off by design (SEC-04).

**What the web app does.** Leaves those columns and tiles out. Each hospital's page shows
its plan.

**What the backend needs.** Only if they are wanted at launch: plan name and bookings
this month on hospital rows; city and booking count on patient account rows, plus
`created_from` and `last_login_from` filters or a counts endpoint; the masked primary
payout account and grace days on the platform hospital profile.

## PRD-06-B — Two receipt settings and the series separator are never used

**What fails.** `PUT /hospital/settings` accepts `receipt_paper` and `receipt_show_staff`,
but nothing reads them: receipts always print the staff name and counter, and the paper
size comes from the print template (backend: `payments/services/receipts.py:147-148`,
`tokens/models/print_template.py:29`). A number series' `separator` is stored and
editable, but `numbering.render` never uses it. `GET /hospital/numbering` returns
`{"results": [...]}` with no paging keys, while `schema.yml` documents a bare array (as
in SCHEMA-01).

**What the web app does.** Reads and saves every other hospital setting, the full token
policy and the MRN, booking and receipt series, and leaves these three out so that no
control does nothing.

**What the backend needs.** Decide whether to use them (receipt layout, a separator
placeholder) or drop them from the API, and fix the `schema.yml` entry.

## PRD-07-B — The desk cannot get a fee quote before booking

**What fails.** Only the patient app has a fee quote (`GET /patient/fee-quotes`), which
knows when a visit is a follow-up. The desk's New Appointment screen adds up each doctor's
consultation fee before booking, so a returning patient's follow-up price (PRD-07) shows
only once the booking is made.

**What the web app does.** Says under the total that follow-up pricing is worked out by
the booking, and shows the real bill before any payment is collected.

**What the backend needs.** A hospital-side quote, e.g. `GET /hospital/fee-quotes`
with `doctor_id` and `hospital_patient_id`, returning `is_follow_up` and the fee.
