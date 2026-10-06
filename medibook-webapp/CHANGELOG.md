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

### Fixed

- Bank accounts, holidays, banners, the onboarding document catalogue and active
  sessions failed to load: their lists are paged.
- The Payments "All" tab hid refunded payments.
- Help & Support showed a placeholder phone number: the app config's legal
  versions are numbers, so the config never loaded.
- A tab left open across a deploy now reloads itself once instead of showing a
  screen that can never load.

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
