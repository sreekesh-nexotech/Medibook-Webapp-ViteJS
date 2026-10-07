# Changelog

All notable changes to the Medibook web app. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). How to cut a release is in
[`docs/RELEASING.md`](docs/RELEASING.md).

## [Unreleased]

### Added

- Cash drawer on Payments: open with a float, see the cash the drawer should hold,
  close with the cash counted, and an admin queue of closed drawers to reconcile.
- Ops hospital page: patient-app listing and online-booking switches, Edit Profile,
  and Commercial Terms (commission and convenience fee). Go-live can open the
  hospital to patients in the same step.
- Landing page for emailed report links (`/reports/downloads/{id}` and
  `/ops/reports/downloads/{id}`); sign-in returns to the link.
- My Account shows the running version and build commit.
- Unit tests, API contract tests against recorded backend responses, browser smoke
  tests for every screen, and a CI workflow that runs the QA gate, the tests and
  `npm audit` on every pull request.

- An offline banner, and a notice with Retry when data on screen could not refresh;
  the rows stay instead of being replaced by an error.
- A branded error page with Reload and Log out for any crash outside a screen.
- Appointment lists that include today refresh every minute.

- Support Tickets in the ops console: filter, find by number, reply (emailed to the
  person who raised it), internal notes, status and priority, and assignment for
  roles that can list staff.
- Error messages show a support reference that matches the backend's logs; every
  API request carries an `X-Request-Id`.
- Error reports — crashes, failed requests, unreadable responses — go to a monitor
  when `VITE_MONITORING_URL` is set, without patient data and at most ten a minute.
- Hospital Settings saves every rule the backend uses: approval of online bookings,
  refunds before and after the cut-off and of the convenience fee, appointment
  notes, missed calls before a no-show, token cancellation, expected consultation
  time, full names on the queue display and approval of patient edits. The token
  label (format, prefix, markers, number ranges, reuse, counter and restart) and a
  new Numbering section for MRN, booking and receipt numbers are editable too, with
  a preview of what the next one will look like.
- Doctors have a follow-up fee and a "Bookable in the Medibook app" switch.
- Ops Logs filter by who acted, by one person and by resource, and name the actor
  where the role can look them up.
- Paste "lat, lng" from a map app into Hospital Settings, and check the point on
  OpenStreetMap.
- The sidebar shows the hospital's own logo to roles with Hospital Settings access.
- Hosting kit: an nginx config, security headers, a post-deploy checker, uptime
  probes and alert rules.
- Setup, deployment, incident, monitoring, browser, performance and roadmap docs.

### Changed

- Fonts ship as five WOFF2 files (59 kB) instead of nine TTF files (1.44 MB).
- Each role polls only what it can read: receptionists no longer poll the admin
  dashboard, and roles without Dashboard access poll none.
- Users & Roles shows 25 people a page; dashboards stack on smaller screens, and no
  screen scrolls sideways from 768 to 1366 px wide.
- Receipts and invoices print in full on A4 and A5, and token slips 72 mm wide.
- The payments CSV follows the Walk-in / Online filter.
- A feature the server has not built yet (501) says "This isn't available in Medibook
  yet." instead of "Something went wrong", and is not reported as a crash.
- Help & Support shows only the contacts the platform has configured, and its FAQs
  match the app.
- The front-desk dashboard shows the serving token's number, not a "T-0xx" label
  the hospital's token format may not use.

### Fixed

- Bank accounts, holidays, banners, the onboarding document catalogue and active
  sessions failed to load: their lists are paged.
- The Payments "All" tab hid refunded payments.
- Help & Support showed a placeholder phone number: the app config's legal
  versions are numbers, so the config never loaded.
- A tab left open across a deploy now reloads itself once instead of showing a
  screen that can never load.

- Dates and "today" follow the hospital's time zone, whatever the device is set to:
  invoices issued just after midnight show the right day, and each date entered
  is sent as the hospital's day.
- Every amount shows two decimals worked out from paise, on screen and in CSVs;
  split payments are added up in paise, and the coupon preview matches the bill.
- Holiday and department edits no longer fail: they send the record version, as
  do leave, date-exception, tax-rate and coupon deletes.
- A retried booking, payment, refund or holiday save reuses its idempotency key,
  and a double click sends one request.
- Payment totals and appointment lists say when only the first part is shown.
- Live updates reconnect when the line goes quiet, say "Live updates off" when
  refused, and close at sign-out.
- An unknown address shows the not-found page instead of redirecting.
- The Held slot style drew 300px top and bottom borders, stretching the Slots &
  Availability legend card; its yellow outline now comes from a token Tailwind
  cannot read as a border width.

- Sign-in and other forms are labelled and submit with Enter; every screen has a
  skip link and a main landmark; dialogs keep focus inside, Escape closes one layer
  at a time, and leaving an edited form asks first; tabs, toggles and sortable
  columns work from the keyboard; toasts are announced and error toasts stay until
  dismissed; text and control colours meet WCAG AA contrast.
- Ops Logs labelled every row "Info" and ignored the severity and module filters.
- The follow-up window's description said return visits are free; they are charged
  the doctor's follow-up fee.

### Removed

- Made-up figures on the sign-in screen, a "Mark all read" button that marked
  nothing, a stand-in map, an image placeholder that only said "demo", and a
  preview that named another hospital.
- Controls that did nothing and columns that were always empty: in Hospital Settings,
  the add-user options, Ops Settings, and the ops lists of hospitals, users and
  patient accounts; the Branches tab. What is not built yet is listed in
  `docs/ROADMAP.md`.
- Unused code: a timer-based "refresh", unused chart and icon components, and the
  Vite default favicon.

### Security

- axios 1.20.0 and source-map-js 1.2.2 (high-severity advisories in earlier
  versions).
- The hospital app signs out after 15 minutes without use, after a one-minute
  warning. The ops console does the same for every platform role, and only
  "Stay signed in" keeps the session.
- "Keep me signed in on this computer" (was "Remember me") is off by default.
- Open tabs share one token refresh and sign out together. Signing out clears the
  session at once, even offline. A rate-limited refresh is retried instead of
  signing the user out.
- The ops console shows each platform role only the screens and actions it holds.
  Front-desk screens and row actions check the role's permissions.
- Production builds carry a Content-Security-Policy, ship only the public `VITE_`
  settings, and validate without `eval`.
- File links must be https on the file-storage host, and ids in API paths are
  URL-encoded.
- Buttons disabled for lack of permission cannot be reached with the keyboard.
- Patient and staff forms no longer let the browser remember other people's
  details, patient pages carry the record id instead of the MR number, and CSV
  cells that a spreadsheet would run as a formula are neutralised.
- Real hospital names, identifiers and images are gone from the app, its docs and
  its test fixtures.
- The app will not start over plain http, except on localhost and the dev server.
- Browsers older than the supported list see an update notice instead of a broken
  page.
- Release builds refuse http API and WebSocket origins.
