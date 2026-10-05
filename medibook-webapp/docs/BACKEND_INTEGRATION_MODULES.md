# Backend integration — module split for parallel sessions

How to replace the web app's fixture-backed Zustand stores with the real Django API,
split into modules that separate Claude CLI sessions can integrate in parallel without
writing to the same files.

- **Web app:** this repo. No network code exists yet: `src/core/api` is empty and every
  screen reads a Zustand store seeded from `*.fixtures.ts`.
- **Backend:** `/Users/neerajapradeep/AMAI/MEDIBOOK/Medibook-backend-django`. The API
  contract is `schema.yml` (OpenAPI) at its root. Endpoints are mounted per surface:
  `/api/v1/hospital/…` (151 endpoints) for the hospital app and `/api/v1/platform/…`
  (124 endpoints) for the ops console, plus `/api/v1/shared/…` and the WebSockets in
  `medibook/routing.py`.
- **Binding standards:** every module follows
  [REACT_VITEJS_ARCHITECTURE.md](REACT_VITEJS_ARCHITECTURE.md) and
  [REACT_VITEJS_CODING_STANDARDS.md](REACT_VITEJS_CODING_STANDARDS.md) — domain /
  infrastructure / application / presentation layers, Zod at the API boundary, query
  keys from `<feature>.keys.ts`, errors as typed `Failure` values.

## How to read the tables

- **Owns** — the only paths that module's session may write. Paths are under
  `src/features/` unless written in full.
- **Backend** — resource groups under `/api/v1/hospital/` for H modules and
  `/api/v1/platform/` for P modules. Look each one up in `schema.yml` for methods and
  shapes.
- **Start after** — modules that must be merged into `main` before this one starts.
- A module ID (for example `H1`) is what you hand to a session: "integrate H1".

## Stage 0 — run alone, one after the other

| ID  | Module                                                                                                            | Owns                                                                                                   | Backend                                               | Start after |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ----------- |
| F0  | API core: HTTP client, env config, error types, token storage, file upload and download helpers, WebSocket helper | `src/core/**`, `src/shared/**`, `src/app/providers/AppProviders.tsx`, `.env.example`, `vite.config.ts` | `/api/v1/shared/files/*`, `/api/v1/shared/app-config` | nothing     |
| F1  | Auth, session and permissions (Login, Forgot password, guards, shells)                                            | `auth/**`, `profile/**`, `src/app/**`                                                                  | `auth/*`, `me`, `permissions` on both surfaces        | F0          |

These two are the only modules allowed to touch `src/core`, `src/shared`, `src/app`,
the routes, `package.json` and config files.

## Stage 1 — 13 in parallel, all start after F1

| ID  | Module                               | Owns                                                                                                      | Backend                                                                                           |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| H1  | Doctors & Departments, Doctor detail | `doctors/**`                                                                                              | `departments`, `doctors`, `doctors/{id}/weekly-sessions`, `leaves`, `date-exceptions`, `schedule` |
| H2  | Hospital Settings                    | in `settings/`: `settings.*` store files, `HospitalSettingsScreen`, `RuleCard`, `RuleRow`, `SettingsHead` | `profile`, `settings`, `hours`, `token-policy`, `billing/bank-accounts`, `numbering`              |
| H6  | Patients, Patient detail             | `patients/**`                                                                                             | `patients`, `patients/{id}/appointments`, `patient-approvals`                                     |
| H12 | Users & Roles                        | `users-roles/**`                                                                                          | `staff`, `staff/invitations`, `roles`, `roles/{code}/permissions`, `roles/{code}/preview`         |
| H15 | Audit Trail                          | `audit/**`                                                                                                | `audit/log`, `audit/log/export.csv`                                                               |
| H16 | Help & Support                       | `help/**`                                                                                                 | `support/tickets`                                                                                 |
| P1  | Subscription Plans                   | `ops-plans/**`                                                                                            | `plans`, `plans/{id}/archive`, `plans/{id}/subscribers`                                           |
| P8  | Ops Reports                          | `ops-reports/**`                                                                                          | `reports`, `report-schedules`                                                                     |
| P9  | Compliance Logs                      | `ops-logs/**`                                                                                             | `logs`                                                                                            |
| P10 | Ops Users & Roles                    | `ops-users/**`                                                                                            | `staff`, `roles`, `permissions`                                                                   |
| P11 | Platform Users, Patient account      | `ops-platform-users/**`                                                                                   | `users`, `users/{id}/block`, `unblock`, `unlock`                                                  |
| P12 | Notifications                        | `ops-notifications/**`                                                                                    | `banners`                                                                                         |
| P13 | Platform Settings                    | `ops-settings/**`                                                                                         | `settings`, `feature-flags`, `tax-rates`                                                          |

## Stage 2 — each starts as soon as its own prerequisites are merged

| ID  | Module                                             | Owns                                                                                                                                        | Backend                                                                                                                                                                  | Start after |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| H3  | Services & Pricing                                 | in `settings/`: `services.*` store files, `ServicesPricingScreen`, `ServiceModal`, `TaxModal`, `CouponModal`                                | `services`, `doctor-services`, `tax-rates`, `coupons`                                                                                                                    | H1          |
| H4  | Hospital Profile                                   | in `settings/`: `profile.*` store files, `HospitalProfileScreen`, `BranchModal`, `HolidayModal`, `PatientBannerModal`, `PatientBannerThumb` | `holidays`, `banners`                                                                                                                                                    | H1          |
| H5  | Slots & Availability                               | `slots/**`                                                                                                                                  | `slots`, `slots/bulk`, `slots/{id}/block`, `slots/{id}/open`, `slots/regenerate`, `slots/generation-runs`                                                                | H1, H2      |
| H10 | Admin and Front Desk dashboards                    | `dashboard/**`                                                                                                                              | `dashboard/admin`, `dashboard/reception`                                                                                                                                 | H1          |
| H11 | Billing & Settlements, with the Plan & Billing tab | `settlements/**`                                                                                                                            | `settlements/periods`, `settlements/payouts`, `statements`, `billing/subscription`, `billing/usage`, `billing/invoices`, `billing/plans`, `billing/plan-change-requests` | H2          |
| H13 | Reports                                            | `reports/**`                                                                                                                                | `reports`, `reports/{code}`, `reports/{code}/export.{fmt}`                                                                                                               | H1          |
| H14 | Messaging                                          | `messaging/**`                                                                                                                              | `messaging/templates`, `messaging/send`, `messaging/deliveries`                                                                                                          | H1, H6      |
| P2  | Hospitals, Hospital detail                         | in `ops-hospitals/`: `hospitals.*` store files, `opsDates.ts`, `OpsHospitalsScreen`, `OpsHospitalDetailScreen`, `OnboardHospitalModal`      | `hospitals` and its actions, except `approve` and `go-live`                                                                                                              | P1          |

## Stage 3

| ID  | Module                                  | Owns                                                                                                                                                    | Backend                                                                                                    | Start after |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------- |
| H7  | Appointments, New Appointment           | `appointments/**`                                                                                                                                       | `appointments` (14 endpoints)                                                                              | H1, H5, H6  |
| P3  | Onboarding                              | in `ops-hospitals/`: `onboarding.*` store files, `OpsOnboardingScreen`, the remaining components; may edit the KYC section of `OpsHospitalDetailScreen` | `onboarding/cases`, `onboarding/document-requirements`, `hospitals/{id}/approve`, `hospitals/{id}/go-live` | P2          |
| P4  | Billing, Invoice detail, Payment detail | `ops-billing/**`                                                                                                                                        | `billing/*`                                                                                                | P2          |
| P5  | Hospital Settlements                    | `ops-settlements/**`                                                                                                                                    | `settlements/*`, `statements`                                                                              | P2          |
| P6  | Ops Dashboard                           | `ops-dashboard/**`                                                                                                                                      | `dashboard`                                                                                                | P2          |
| P7  | Usage Analytics                         | `ops-analytics/**`                                                                                                                                      | `analytics/*`                                                                                              | P2          |
| P14 | Compliance                              | `ops-compliance/**`                                                                                                                                     | `compliance/login-history`, `compliance/config-changes`, `compliance/data-requests`                        | P2, P11     |

## Stage 4

| ID  | Module           | Owns             | Backend                                                                 | Start after |
| --- | ---------------- | ---------------- | ----------------------------------------------------------------------- | ----------- |
| H8  | Token Management | `token-queue/**` | `sessions` (14 endpoints), `counters`, WebSocket `ws/hospital/queue`    | H1, H7      |
| H9  | Payments         | `payments/**`    | `payments`, `refunds`, `payments/export.*`, `visits/*`, `cash-sessions` | H1, H7      |

## Stage 5 — run alone, last

| ID  | Module                  | What it does                                                                                                                                                                                                 | Start after |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Z   | Cross-links and cleanup | Finishes the links between modules: hospital-detail invoice, payment and settlement tabs, both topbar bells, anything sessions deferred. Then deletes fixtures, legacy stores and `src/core/config/demo.ts`. | everything  |

## Why the order is what it is

- **F0 and F1 block everything.** Every other module needs the HTTP client, tokens and
  the real permission set.
- **H1 and H2 come early.** Eight features read the doctors catalogue store, and slots,
  doctors and settlements read the settings store.
- **H7 is the largest module and gates H8 and H9.** Token queue and payments read the
  appointments store, and Payments reuses its payment, receipt and refund modals.
- **P2 gates most of the ops console.** Billing, settlements, dashboard, analytics,
  onboarding and compliance all read the hospitals store.
- **The hospital and ops stores are cross-wired** so the prototype could simulate both
  sides in one browser. Each module cuts only its own links; Z removes what is left.

## Rules every session must follow

1. **One git worktree and branch per session.** The QA gate type-checks and builds the
   whole project, so two sessions in one folder would fail on each other's half-finished
   work. Each worktree needs its own `npm install`.
2. **Write only inside the "Owns" paths.** Everything else is read-only, including
   `package.json`, so no new dependencies.
3. **Do not delete or reshape the existing store, types, logic or fixture files.** Other
   features and the layouts still import them; sessions add the new layers alongside and
   rewire only their own screens. Z removes the old files.
4. **Read another module's data only if that module is in "Start after".** Use its query
   hooks and never edit its files. If a link to an unmerged module is needed, leave the
   existing read in place and list it in the PR description for Z.
5. **Give new files a module prefix** (for example `services.api.ts`,
   `onboarding.keys.ts`). This matters in the two shared folders, `settings/` (H2, H3,
   H4) and `ops-hospitals/` (P2, P3).
6. **Treat the backend as read-only.** All sessions share one database, so no session
   edits backend code, migrates or re-seeds.
7. **Merge one branch at a time** and re-run the QA gate on `main` after each merge:
   `npm run lint` · `npm run typecheck` · `npm run format:check` · `npm run build`.

## Decisions to settle in Stage 0

- **Dev-server ports (F0):** the backend's CORS allowlist is per surface
  (`CORS_ORIGINS_HOSPITAL`, `CORS_ORIGINS_PLATFORM` in `medibook/settings/base.py`) and
  empty by default, and each worktree's dev server gets a different port. Recommended:
  route API calls through a Vite dev proxy so the port does not matter. Alternative:
  list every port in the backend env.
- **Roles (F1):** the app puts the role in the URL (`/:role`) with a role switcher in
  the topbar, while the backend has real per-user roles and permissions. F1 decides how
  they map.
- **Auth screens that do not exist yet (F1):** MFA verification, password reset from
  the emailed link, staff invitation acceptance and my-account (change password,
  sessions). F1 is the only module that may add routes for them.

## Known mismatches

Screens with no matching backend path in `schema.yml` — sessions flag these rather than
build around them:

- **H4:** the Branches tab.
- **H14:** the Announcements tab and template editing (hospital templates are
  read-only).
- **P12:** composing and scheduling push notifications.
- **H16:** the FAQ list (FAQs exist only on the patient and platform surfaces).
- **H7:** fee waive and reschedule have no dedicated endpoint; they may be covered by
  the appointment `PATCH` — not yet checked.

Backend features with no screen yet (not assigned to any module):

- **Hospital:** counters admin, display devices, print templates, cash sessions admin.
- **Platform:** support tickets, FAQs, legal documents, locations, ambulance providers,
  reviews, messaging templates.

## Starting a session

Open a new Claude CLI session in its own worktree and say:

> Integrate module `<ID>` from `docs/BACKEND_INTEGRATION_MODULES.md`. The backend is at
> `/Users/neerajapradeep/AMAI/MEDIBOOK/Medibook-backend-django` (read-only; contract in
> `schema.yml`). Follow the session rules in that file.
