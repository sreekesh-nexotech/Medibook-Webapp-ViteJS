# Backend blockers for go-live

Issues from the go-live checklist that the web app cannot fix on its own, plus
related backend and environment gaps found while fixing the rest.
Each entry says what fails, the evidence, what the backend needs to change, and what
the web app does in the meantime.

Found on 6 Oct 2026 against the shared test backend while fixing the Day-one
workflows (`claude/core-day-one`) and the release items (`claude/rel-sec-hardening`).
Paths under `backend:` are in the Django repository.

## Summary

| ID        | Problem                                                       | Severity | Web app status                              |
| --------- | ------------------------------------------------------------- | -------- | ------------------------------------------- |
| CORE-07   | Receptionists cannot book appointments (403 on doctors/slots) | Blocker  | Needs backend; admin stopgap available      |
| ENV-03    | No resettable staging backend for end-to-end tests and UAT    | High     | Read-only smoke tests only                  |
| SEC-04    | No multi-factor sign-in (MFA endpoints answer 501)            | High     | Needs backend and a product decision        |
| SEC-07-B  | Token refresh shares the per-address sign-in limit            | High     | App retries once after `Retry-After`        |
| SEC-01-B  | Background polls keep a server session from going idle        | Medium   | App signs idle tabs out itself              |
| SEC-06-B  | Reusing a just-rotated refresh token revokes the session      | Medium   | App coordinates refresh across tabs         |
| CORE-04   | No platform endpoint to re-send the first-admin invitation    | High     | Needs backend                               |
| ROLE-01   | Only admins can refund cash at the desk                       | Medium   | Product decision on role templates          |
| CORE-03-B | Go-live does not open the hospital to patients atomically     | Medium   | Web app works around it (2 calls)           |
| ENV-01    | Email links are relative when the frontend URLs are unset     | High     | Deployment setting                          |
| SCHEMA-01 | `schema.yml` documents paginated lists as bare arrays         | Medium   | Web app fixed (CORE-01)                     |
| ENV-02    | Test backend signs file links for an unreachable host         | Medium   | Blocks end-to-end download testing          |
| API-01    | No way to read a hospital's commission history                | Low      | Future-dated rates are invisible            |
| DASH-01   | Admin dashboard counts cancelled bookings as appointments     | Medium   | Web app subtracts them; walk-ins can't      |
| DASH-02   | Refunds are not split by channel or payment method            | Medium   | Front desk shows refunds separately         |
| DASH-03   | No server-side read state for hospital notifications          | Low      | Bell remembers "read" per browser tab       |
| APPT-01   | A refunded walk-in stays scheduled and can check in unpaid    | High     | Desk must collect again before check-in     |
| APPT-02   | Cancelled unpaid bookings keep payment status "pending"       | Low      | Shown as "Not paid"                         |
| APPT-03   | No per-hospital list of accepted desk payment methods         | Low      | Fixed list: cash, UPI, card, POS, other     |
| APPT-04   | Appointment history names no actor                            | Low      | Shows patient / staff / system only         |
| APPT-05   | The desk cannot preview a walk-in's real fee before booking   | Medium   | Shows standard and follow-up fee            |
| APPT-06   | Desk staff cannot read services, so no service can be booked  | Medium   | Bookings use the doctor's fee only          |
| APPT-07   | A cancelled appointment keeps the token it gave up            | Medium   | Patients history hides it on cancelled rows |
| PAT-01    | The patient list carries no visit count                       | Low      | One extra request per row                   |
| TOK-01    | Desk roles cannot read the expected consultation time         | Low      | Falls back to 20 minutes for them           |
| TOK-02    | A session snapshot does not list its queue                    | Medium   | Queue rebuilt from the appointment list     |
| PAY-02    | Refunding one consultation of a visit refunds the whole visit | High     | Desk collects per consultation              |
| PAY-01    | Payments cannot be filtered by source (desk / online)         | Low      | Source filters the visible page only        |

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

## DASH-01 — The admin dashboard counts cancelled bookings

**New finding (live check of the hospital dashboard, 6 Oct 2026).**

**What fails.** For the same day the two dashboards disagree. On Lakeshore,
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
settlement periods). The hospital API has no notifications or read-receipt endpoint, so
"Mark all read" cannot be stored: it does not survive a reload and does not carry over to
other devices or tabs.

**What the backend needs.** Either a hospital notifications feed with read state
(`GET /hospital/notifications`, `POST …/read`), or a per-staff "last seen" timestamp for
the alert counts.

**What the web app does meanwhile.** Every bell item counts towards the badge. "Mark all
read" clears the badge for that tab until a count changes (a new booking or drawer makes
the item unread again).

## APPT-01 — A refunded walk-in stays scheduled and can be checked in unpaid

**New finding (live check of the Appointments screen, 6 Oct 2026).**

**What fails.** A desk refund on a walk-in whose visit is still on changes only the
payment status: the appointment stays `scheduled` with `payment_status = refunded`
(backend: `payments/services/refunds.py:106-119`). Check-in looks only at the status and
the date, not at payment (backend: `appointments/services/desk.py:164-171`), so the
patient can be checked in and seen after their money was handed back. On Lakeshore today
the only live walk-in is in exactly this state, and the screen offered "Check in" for it.

**What the backend needs.** Either cancel the appointment when its payment is refunded
in full while the visit is still on, or refuse check-in for a walk-in that is not paid
(`APPOINTMENT_NOT_ACTIONABLE`).

**What the web app does meanwhile.** A refunded walk-in whose visit is still on counts
as Pending Payment: its action is Collect (the backend accepts a new payment for it), the
drawer explains the refund, and Check in is hidden until it is paid again.

## APPT-02 — Cancelled unpaid bookings keep payment status "pending"

**What fails.** An online booking cancelled before checkout completed keeps
`payment_status = pending` for good. On Lakeshore today 12 of 13 appointments are such
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
endpoint returns that quote before booking. On Lakeshore, 2 of the 12 most recent
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
`appointments/serializers/hospital_walk_in_consultation_serializer.py:9`), and Lakeshore has
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
appointment keeps its `token_label` and `token_no`. On Lakeshore today, 12 cancelled
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
`tokens/services/queue.py:343-344`, Q29). On Lakeshore no doctor sets one, so the hospital
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
