# Presentation Layer Build Spec — Medibook mbAdmin + Operations Console

**Binding for every agent working on the presentation build.** Read this file, then
`docs/CLAUDE.md`, `docs/REACT_VITEJS_ARCHITECTURE.md`, and
`docs/REACT_VITEJS_CODING_STANDARDS.md` (all binding), then your assigned design source
files, before writing code.

## 1. What we are building

A pixel-accurate, **fully interactive** port of the approved Claude Design prototype into
this repo's presentation layer, running on **static seed data** held in per-feature Zustand
stores. No APIs, no domain/infrastructure code — a later session (Prompt A in
`docs/REACT_VITEJS_CLAUDE_FEATURE_PROMPTS.md`) generates those layers and swaps the fixtures
for TanStack Query hooks. Everything you build must make that swap trivial.

**Design source of truth** (read-only, outside this repo):

- `/home/claude/repo/project/src/*.jsx` — every screen/component as working React (inline
  styles). This is the spec: port the _visual output and behaviour_ 1:1.
- `/home/claude/repo/project/Medibook mbAdmin.html` — routing, shell composition, error
  boundary, view titles.
- `/home/claude/repo/project/colors_and_type.css` — original tokens (already ported to
  `src/index.css` `@theme` with approved tweaks — see §3).
- `/home/claude/repo/docs/*.md` — product brief, screen inventory, data model (context).

**Do NOT port:** `browser-window.jsx`, `tweaks-panel.jsx`, `TWEAK_DEFAULTS`/`useTweaks`,
`CompactPages`/`PAGES`, `useFitScale`/`WindowFrame`, the 88% zoom wrapper, the fixed
`CW/CH` stage, the launcher button, or `lucide.createIcons()` calls.

## 2. Locked decisions (user-approved — do not relitigate)

1. **Fully interactive** on seed data — check-in issues tokens, queue Call Next works,
   ops release mirrors to the hospital ledger, etc., exactly like the prototype.
2. **lucide-react** for icons (registry already built) + **self-hosted Poppins**
   (`public/fonts`, `@font-face` done).
3. **Tokens first, documented one-offs allowed** — see §3 translation rules.
4. **Build at 100% zoom** — the prototype's `scale(0.88)` wrapper is NOT ported. The
   approved accent `#2563EB`, navy `#0E2A4A`, and **Comfy density** (22px vertical padding
   on all `td`/`th`, global base rule — do NOT re-add per-cell `py-*`) ARE ported.
5. TypeScript `strict` is on.

## 3. Styling translation (design inline styles → Tailwind v4)

Tokens live in `src/index.css` `@theme`. Utility name = token name minus the namespace:

| Design source                                                                       | Tailwind class                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `var(--blue)` / `var(--blue-strong)` / `var(--blue-soft-bg)`                        | `blue` / `blue-strong` / `blue-soft-bg` (e.g. `bg-blue-soft-bg`, `text-blue`)                                                                                                                                                     |
| `var(--p-500)`, `var(--g-600)`, `var(--y-100)`, `var(--d-500)`, `var(--grey-300)` … | `p-500`, `g-600`, `y-100`, `d-500`, `grey-300` …                                                                                                                                                                                  |
| `var(--text-strong/body/muted/faint/navy)`                                          | `text-text-strong`, `text-text-body`, `text-text-muted`, `text-text-faint`, `text-text-navy`                                                                                                                                      |
| `var(--bg-app/surface/subtle/tint)`                                                 | `bg-bg-app`, `bg-bg-surface`, `bg-bg-tint`, …                                                                                                                                                                                     |
| `var(--border)` / `--border-soft` / `--border-input`                                | `border-border`, `border-border-soft`, `border-border-input`                                                                                                                                                                      |
| `var(--badge-*-bg/fg)`                                                              | `bg-badge-scheduled-bg`, `text-badge-scheduled-fg`, …                                                                                                                                                                             |
| `#EA7C2B`                                                                           | `orange` (token)                                                                                                                                                                                                                  |
| `#fff` / `#000`                                                                     | `white` / `black`                                                                                                                                                                                                                 |
| `rgba(17,24,39,.45)` scrim                                                          | `bg-text-strong/45`                                                                                                                                                                                                               |
| `rgba(255,255,255,.2)` etc.                                                         | `bg-white/20` (opacity modifier)                                                                                                                                                                                                  |
| `font: var(--h1/h2/h3/display/stat-number/body/body-lg/caption)`                    | `text-h1`, `text-h2`, `text-h3`, `text-display`, `text-stat`, `text-body`, `text-body-lg`, `text-caption` (weight + line-height ride the token)                                                                                   |
| `font: var(--body-md)`                                                              | `text-body font-medium`                                                                                                                                                                                                           |
| `font: var(--label)`                                                                | `text-label font-ui` (+ `tracking` is in the token)                                                                                                                                                                               |
| `font: 600 14px var(--font-sans)`                                                   | `text-body font-semibold` (normalize line-height to the ramp token)                                                                                                                                                               |
| `font: 700 28px …`                                                                  | `text-stat` — always map to the ramp token with the same px size                                                                                                                                                                  |
| 11px / 12.5px / 16px-500 text                                                       | `text-tiny`, `text-badge`, `text-button` tokens                                                                                                                                                                                   |
| Other one-off sizes (10px, 10.5px, 13px, 15px, 18px, 22px, 26px, 30px, 34px, 52px…) | `text-[10.5px]` arbitrary — allowed for these documented one-offs only                                                                                                                                                            |
| `className="num"` / `fontVariantNumeric`                                            | `tabular-nums` (built-in utility)                                                                                                                                                                                                 |
| `borderRadius: "var(--r-xl/lg/md/sm/xs)"`                                           | `rounded-xl`, `rounded-lg`, `rounded-md`, `rounded-sm`, `rounded-xs` (tokens redefined to 16/12/8/5/2)                                                                                                                            |
| `borderRadius: 10` (inputs)                                                         | `rounded-input` (token)                                                                                                                                                                                                           |
| `borderRadius: 9999 / "var(--r-pill)" / "50%"`                                      | `rounded-full`                                                                                                                                                                                                                    |
| `boxShadow: var(--shadow-card/pop)`                                                 | `shadow-card`, `shadow-pop`                                                                                                                                                                                                       |
| px spacing/size values                                                              | Tailwind dynamic scale — 1px = 0.25 step: `14px→p-3.5`, `18px→gap-4.5`, `22px→py-5.5`, `11px→px-2.75`, `332px→w-83`, `230px→w-57.5`, `56px→size-14`. **Never `p-[14px]`-style arbitrary spacing — the scale expresses every px.** |
| 254px sidebar / 76px collapsed / 87px topbar                                        | `w-sidebar`, `w-sidebar-compact`, `h-topbar` (tokens)                                                                                                                                                                             |
| animations `fadeIn/popIn/slideIn/toastIn/opsPulse`                                  | `animate-fade-in`, `animate-pop-in`, `animate-slide-in`, `animate-toast-in`, `animate-skeleton-pulse`                                                                                                                             |
| JS `onMouseEnter` background swaps                                                  | `hover:` variants + `transition-colors duration-150` (same visual, no JS)                                                                                                                                                         |
| gradients (`linear-gradient(160deg, p-500, p-600)`)                                 | `bg-linear-160 from-p-500 to-p-600`                                                                                                                                                                                               |

**The `style` prop is allowed ONLY for runtime data-driven values** — chart bar heights,
progress `%` widths, per-item colors coming from data (`dept.color`, role dots), map-pin
coordinates, uploaded image previews, dynamic `size` props. Static styling is Tailwind
classes, no exceptions. No new `.css` files. No `tailwind.config.js`. Conditional classes
via `cn()` from `@/shared/lib/cn`.

Default Tailwind colors are **wiped** — `text-gray-500` etc. do not exist; if you type one
the class silently won't compile, so only use Medibook tokens.

## 4. Architecture placement (this phase)

```
src/
├── app/
│   ├── providers/AppProviders.tsx        # QueryClientProvider (idle), Router
│   ├── router/                           # route tree, guards, route constants
│   └── layouts/                          # HospitalShell, OpsShell + their Sidebar/Topbar/bell
├── core/config/demo.ts                   # DEMO_TODAY, SAMPLE_HOSPITAL_ID, SETTLE_COMMISSION  [done]
├── shared/
│   ├── lib/cn.ts, format.ts              # [done]
│   └── ui/                               # design-system components (§5)
└── features/<feature>/
    ├── application/store/
    │   ├── <feature>.types.ts            # readonly view-model types (interim entities)
    │   ├── <feature>.fixtures.ts         # seed data, typed against .types.ts
    │   └── <feature>.store.ts            # Zustand store: state seeded from fixtures + actions
    └── presentation/
        ├── components/                   # feature-specific pieces (PascalCase.tsx)
        └── screens/                      # <Name>Screen.tsx
```

- Stores live in the **owning** feature; other features import them via
  `@/features/<owner>/application/store/<name>.store` — documented cross-feature reads
  (they model the future shared query cache). `app/` may import any feature (composition
  root).
- **No barrel `index.ts` files anywhere** — direct file imports only (avoids conflicts).
- Store conventions: `create<State & Actions>()`, actions defined inside the store,
  components read via selectors, action names copied 1:1 from the prototype's `Actions`
  object (`checkIn`, `markPaid`, `settleRelease`, …) so later query-hook swaps are
  mechanical. Toasts fire from actions via `toast()` from
  `@/shared/ui/toast/toast.store` exactly where the prototype called `window.toast`.
- `useSort` hook → `@/shared/hooks/useSort.ts`.

## 5. shared/ui inventory (port 1:1 from `/home/claude/repo/project/src/ui.jsx` + `Ops.jsx`)

One component per file, `PascalCase.tsx`, props preserved from the prototype (TypeScript-ed).

- **Done:** `Icon.tsx` (+ `icon-registry.ts`).
- **Core:** `Rupee`, `Button` (variants primary/secondary/info/ghost/danger/success; sizes
  sm/md), `IconBtn`, `Badge` (+ `status-map.ts` exporting the full `STATUS` record — ALL
  hospital + ops statuses from both `ui.jsx` and `Ops.jsx`; unknown → Scheduled styling),
  `Card`, `SectionTitle`, `Avatar`, `Toggle`.
- **Forms:** `Field`, `Select`, `TextInput`, `FilterSelect`, `SearchField`, `Tabs`,
  `SegTabs`, `InfoDot`, `ImageUpload`, `ClearChip`, `RefreshBtn`.
- **Overlays/feedback:** `Modal`, `Drawer`, `toast/` (`toast.store.ts` Zustand +
  `ToastHost.tsx` + exported `toast(msg, type)`), `ConfirmModal` (generic confirm from
  `Flows.jsx`), `OpsConfirm` (centered icon confirm with summary rows, from `Ops.jsx`),
  `OpsField` (label + inline error), `OpsSkeleton`, `Pager`.
- **Data display:** `TableShell` (+ `SortTh`), `StatCard`, `KpiStrip` (the `KStrip` row),
  `InfoGrid`, `OpsEntity`, `OpsPerson`, `BarChart`, `LineChart`, `Donut`.
- **Note:** prototype `Modal`/`Drawer`/`OpsConfirm` use `position:absolute` against the
  windowed stage — port as `fixed inset-0` full-viewport overlays (same visual at 100%).
- `LineChart`'s SVG gradient id must be unique per instance (`useId`) — the prototype's
  fixed `id="lcg"` breaks with multiple charts.

## 6. Feature map, routes, store ownership

Auth state: `features/auth/application/store/auth.store.ts` — `{ authed, role:
'receptionist' | 'admin' | 'ops' }` + `login(kind)`, `logout()`, `switchRole(role)`.
Persist nothing.

| Feature              | Routes                                                                   | Screens (from design)                                                                              | Owns stores                                                                                                              |
| -------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `auth`               | `/auth/login`, `/auth/forgot`                                            | `Login`, `ForgotPassword` (`Auth.jsx`)                                                             | auth.store                                                                                                               |
| `dashboard`          | `/:role/dashboard`                                                       | `ReceptionistDashboard`, `AdminDashboard` (`Dashboard.jsx`)                                        | —                                                                                                                        |
| `appointments`       | `/:role/appointments`, `/:role/appointments/new`                         | `Appointments`, `CreateAppointment` (`Screens.jsx`) + all modals in `Flows.jsx`                    | appointments.store (appts, serving, docStatus, tokenSeq, activeDept, lastReceipt + every appointment/queue action)       |
| `patients`           | `/:role/patients`, `/:role/patients/:mrn`                                | `Patients`, `PatientDetail`, `PatientModal`                                                        | patients.store                                                                                                           |
| `token-queue`        | `/:role/token`                                                           | `TokenCounters`, `DoctorQueueCard`                                                                 | — (reads appointments.store)                                                                                             |
| `payments`           | `/:role/payments`                                                        | `Payments` (`Billing.jsx`)                                                                         | —                                                                                                                        |
| `settlements`        | `/admin/settlements`                                                     | `Settlements`, `PlanBilling`                                                                       | settlements.store (hospital ledger + planChangeReq)                                                                      |
| `doctors`            | `/admin/doctors`, `/admin/doctors/:id`                                   | `DoctorsDepartments`, `DoctorDetailPage`, `DeptModal`, `DeptDrawer`, `WeeklyHours` (`Catalog.jsx`) | catalog.store                                                                                                            |
| `users-roles`        | `/admin/users`                                                           | `UsersRoles` + editors (`Rbac.jsx`)                                                                | rbac.store                                                                                                               |
| `reports`            | `/admin/reports`                                                         | `Reports` (`Admin.jsx`)                                                                            | —                                                                                                                        |
| `settings`           | `/admin/settings`                                                        | `HospitalSettings` (`Admin.jsx`)                                                                   | settings.store                                                                                                           |
| `help`               | `/:role/help`                                                            | `HelpSupport` (`Admin.jsx`)                                                                        | —                                                                                                                        |
| `ops-dashboard`      | `/ops/dashboard`                                                         | `OpsDashboard`                                                                                     | ops-inbox.store (alerts + requests)                                                                                      |
| `ops-hospitals`      | `/ops/hospitals`, `/ops/hospitals/:id`                                   | `OpsHospitals`, `OpsHospitalDetail`, `OnboardHospitalModal`                                        | hospitals.store (registry + KYC helpers, `hospName`, `bankOf`, `gstinOf`, `opsDeptsFor`, `opsDocsFor`, `opsBookingsFor`) |
| `ops-plans`          | `/ops/plans`                                                             | `OpsPlans`, `PlanModal`                                                                            | plans.store (catalog + planChanges)                                                                                      |
| `ops-billing`        | `/ops/billing`, `/ops/billing/invoices/:id`, `/ops/billing/payments/:id` | `OpsBilling`, `OpsInvoiceDetail`, `OpsPaymentDetail`                                               | billing.store (invoices + payments)                                                                                      |
| `ops-settlements`    | `/ops/settlements`                                                       | `OpsSettlements` (payout runs + flat list + release modals)                                        | ops-settlements.store (non-Example Hospital rows; screen merges hospital settlements.store — the live link)              |
| `ops-analytics`      | `/ops/analytics`                                                         | `OpsAnalytics`                                                                                     | —                                                                                                                        |
| `ops-reports`        | `/ops/reports`                                                           | `OpsReports`                                                                                       | ops-reports.store (reportsGen)                                                                                           |
| `ops-logs`           | `/ops/logs`                                                              | `OpsLogs`                                                                                          | logs.store (written to by many features' actions)                                                                        |
| `ops-users`          | `/ops/users`                                                             | `OpsUsers`, `AddOpsUserModal`, `OpsRoleAnnotation`                                                 | ops-users.store                                                                                                          |
| `ops-platform-users` | `/ops/platform-users`, `/ops/platform-users/:id`                         | `OpsPlatformUsers`, `OpsPlatformUserDetail`                                                        | platform-users.store                                                                                                     |
| `ops-notifications`  | `/ops/notifications`                                                     | `OpsNotifications`, `BannerModal`, `BannerThumb`                                                   | notifications.store (banners + fallback + pushes)                                                                        |
| `ops-settings`       | `/ops/settings`                                                          | `OpsSettings`                                                                                      | ops-settings.store                                                                                                       |

Routing rules:

- Selection state that the prototype kept in `OpsSel`/`Store` (`selectedMrn`,
  `selectedDoctorId`, `OpsSel.hosp/inv/pay/pu`) becomes **URL params**; `OpsSel.billTab`
  and similar cross-navigation tab presets become **`?tab=` search params**. Invalid or
  missing ids fall back exactly like the prototype (first record).
- Role gates: receptionist is blocked from admin-only views (`settlements`, `doctors`,
  `users`, `reports`, `settings`) → redirect to `/:role/dashboard`. `/ops/*` requires the
  ops role. Route guards live in `app/router/`.
- Titles/subtitles per view come from the design's `VIEW_TITLE`/`titleFor`/`subFor` and
  `OPS_META` — live in the layouts.
- The topbar **back button** replicates the prototype: each shell keeps its own visited-view
  history stack (synchronously updated on render), pops to the previous _allowed_ view;
  hidden when the stack has one entry.
- Hospital topbar role switcher: switches `auth.store` role; if the current view isn't
  allowed for the new role, go to dashboard. Log Out → `/auth/login`.
- Ops shell shows `OpsSkeleton` for 450ms on every view change (design behaviour).
- Per-view error boundary with the `ScreenError` card (Retry / Back to Dashboard).

## 7. Fixtures (seed data)

Transcribe the prototype's seeds **verbatim** — every record, every field value, same
order: `SEED` appointments, derived patients (+ the AREAS emails/addresses logic — but
materialize the derived list as literal data), `DEPTS_DATA`, `DOCS_DATA`, `DOCTOR_META`,
`FEES`, settlements (`seedSettlements()` output, materialized with computed
commission/net), `DEFAULT_SETTINGS`, `seedRoles()`/`seedUsers()`, and the whole `OpsDB`
(hospitals, plans, invoices, payments, settlements, planChanges, logs, users,
platformUsers, alerts, requests, banners, bannerFallback, pushes, settings). Types are
`readonly` interfaces in `<feature>.types.ts`. Fixture arrays are `const` and typed.
Derived values the prototype computed at seed time (`hid` back-fill via `OPS_NAME_TO_ID`,
`commission`/`net` at 10%) are materialized as literals. Union types for statuses/enums
(`AppointmentStatus`, `PaymentState`, `HospitalStatus`, …) — no bare `string` where the
design has a closed set.

## 8. Faithfulness rules

- Port behaviour _as it is in the prototype_, including its quirks — this phase is a
  100%-match port, not a redesign. (The functional audit backlog is for later sessions.)
- Every string of copy verbatim — labels, empty states, helper text, toasts, confirm
  bodies. Title Case headers, sentence-case helpers, ₹ with en-IN grouping, no emoji.
- All four UI states where the design has them (loading skeletons, error boundary, written
  empty states, success), all filters/sorts/pagination working, all modals/drawers wired.
- CSV exports (Payments, Settlements, hospital Reports) work via Blob download exactly as
  in the design; "Export PDF" and other demo-only stubs keep their toast behaviour.
- Replace `Date.now()`/`Math.random()` id-minting with a tiny counter/uuid helper where
  needed — behaviourally identical.
- `alt` text on images; buttons are `<button>`; keep the design's clickable-row semantics.

## 9. Hard boundaries for agents

1. Touch **only** files inside your assigned feature/area. Never edit `src/index.css`,
   `shared/`, `core/`, `app/`, or another feature (foundation agents excepted, per their
   brief). If something you need is missing from shared, build it feature-local and flag
   it in your report.
2. Format only your own files: `npx prettier --write <paths>`. Never run repo-wide
   format/lint fixes.
3. No new dependencies. No `console.log`. No `any`. No non-null `!` unless provably safe.
4. Import order per standards §9; `@/` alias only.
5. Your report must list: files created, cross-feature stores you read, any deviation +
   why, and any design detail you could not reproduce (do not silently approximate).

## 10. QA gate

`npm run lint` + `npm run typecheck` + `npm run format:check` + `npm run build` — all
zero-error (run from `medibook-webapp/`). Bare `npx tsc --noEmit` false-passes; use the
npm scripts. Pixel QC: screens are screenshot-compared against the design prototype
(`Medibook mbAdmin (standalone).html`) — accuracy is checked, not assumed.
