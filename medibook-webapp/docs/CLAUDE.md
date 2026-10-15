# docs — Specification Index (React + Vite)

Source-of-truth specs for building the Medibook web app. These documents are
**binding**, not suggestions — they take priority over your own defaults, general
best-practice habits, or patterns from other projects. Read the relevant file(s) in
full before writing code for that area; this page is only a router.

**Stack baked into these docs:** React + Vite · TypeScript (strict) · TanStack Query
(server state) · Zustand (client state) · Axios · Zod · React Router · Tailwind CSS v4
(styling) · oxlint (lint) + Prettier (format).

## Files

| File                                     | One-liner                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                              | Quick-start note: run `scaffold-structure.sh --create <app-name> <feature...>` to generate a new React + Vite project with the standard structure, stack, and Tailwind/alias wiring.                                                                                                                                                                                                        |
| `scaffold-structure.sh`                  | Idempotent Bash scaffolder: creates the feature-first Clean Architecture folders (`app/`, `core/`, `shared/`, plus a 4-layer folder set per feature), installs the standard stack, and wires Tailwind v4, the `@` path alias, Prettier, and the `cn()` helper. `--create <name>` bootstraps a fresh Vite project first; `SKIP_INSTALL=1` skips npm installs.                                |
| `REACT_VITEJS_ARCHITECTURE.md`           | **The architecture standard:** why server state goes to TanStack Query and client state to Zustand (vs Redux), the full `src/` folder tree with the four layers (`domain` → DECLARE, `infrastructure` → DEFINE, `application` → CALL, `presentation` → DISPLAY), the Tailwind styling layer (§2.1), and a layer-by-layer Flutter → React mapping.                                           |
| `REACT_VITEJS_CODING_STANDARDS.md`       | **The binding rulebook:** dependencies-point-inward golden rule, naming tables, strict-TypeScript rules (no `any`, no `!`), the TanStack Query vs Zustand split, per-layer do's and don'ts, error handling via `Failure`/`Result`, component and hook rules, Tailwind v4 styling rules (§8), lint/format gate, env & config, dependency policy, and the pre-PR self-review checklist (§12). |
| `REACT_VITEJS_CLAUDE_FEATURE_PROMPTS.md` | Copy-paste Claude Code prompt pack: **Prompt A** generates the domain + infrastructure + application layers for one feature from a pasted backend API contract (presentation layer assumed already built), **Prompt A-AUTH** adds session/auth specifics on top, and **Prompt B** does a surgical bug fix from reported UI/console errors.                                                  |

## Other documents in `docs/`

Current — they describe the code as it is:

| File                                             | What it covers                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| [`SETUP.md`](SETUP.md)                           | Setting up a machine, env files, pointing the app at a backend          |
| [`RELEASING.md`](RELEASING.md)                   | Branches, the QA gate, tests and fixtures, cutting a release            |
| [`DEPLOYMENT.md`](DEPLOYMENT.md)                 | Build settings, hosting rules, nginx, releasing and rolling back        |
| [`INCIDENTS.md`](INCIDENTS.md)                   | Handling an incident: checks, rollback, support references, known fixes |
| [`MONITORING.md`](MONITORING.md)                 | Error reports, support references, running version, uptime alerts       |
| [`SECURITY_HEADERS.md`](SECURITY_HEADERS.md)     | The Content-Security-Policy and other response headers                  |
| [`SUPPORTED_BROWSERS.md`](SUPPORTED_BROWSERS.md) | Browsers and screens the app supports                                   |
| [`PERFORMANCE.md`](PERFORMANCE.md)               | Polling, list limits, fonts and navigation                              |
| [`UAT_SCRIPTS.md`](UAT_SCRIPTS.md)               | User-acceptance scripts per role                                        |
| [`BACKEND_BLOCKERS.md`](BACKEND_BLOCKERS.md)     | Backend and environment gaps the web app cannot fix alone               |
| [`ROADMAP.md`](ROADMAP.md)                       | Capabilities not in the app at launch, and their status                 |

Historical — kept as a record, not a description of the current code:
[`PRESENTATION_BUILD_SPEC.md`](PRESENTATION_BUILD_SPEC.md),
[`BACKEND_INTEGRATION_MODULES.md`](BACKEND_INTEGRATION_MODULES.md),
[`BRD-Medibook-Frontend-Derived.md`](BRD-Medibook-Frontend-Derived.md) and its older
`.docx` export.

## Suggested read order when building

1. `README.md` + `scaffold-structure.sh` → create/scaffold the project
2. `REACT_VITEJS_ARCHITECTURE.md` → the architecture and folder layout every feature must follow
3. `REACT_VITEJS_CODING_STANDARDS.md` → the rules all code is reviewed against
4. `REACT_VITEJS_CLAUDE_FEATURE_PROMPTS.md` → the prompts to drive per-feature generation and bug fixes

## Non-negotiables pulled from the above

- Layer direction: `presentation → application → domain`, `infrastructure → domain`.
  `domain` imports nothing. Breaking layer rules is a failure even if the code "works".
- `presentation` never touches Axios/storage/data-sources — only `application` hooks.
- Server data = TanStack Query; UI/client state = Zustand. Never mix the two roles.
- Zod-validate every API response at the infrastructure boundary; DTOs never leak
  above infrastructure.
- Styling = Tailwind CSS v4 only, in the presentation layer only. Tokens live in
  `@theme` (`src/index.css`); no raw hex, no arbitrary `[13px]` values, no new `.css`
  files, no inline styles. v4 is CSS-first — never add `tailwind.config.js` or
  `postcss.config.js`.
- Imports use the `@/` path alias (wired in `vite.config.ts` + `tsconfig.app.json`).
- TypeScript strict stays on; no `any`, no magic literals, no `console.log`, no
  silent `catch {}`. Handle loading / error / empty / success in the UI.
- QA gate before done: `npm run lint` + `npm run typecheck` + `npm run format:check` +
  `npm run build`, all zero-error. (Bare `npx tsc --noEmit` false-passes here — the
  root tsconfig is a solution file; always use `npm run typecheck`.)

## Conflict policy — FLAG, do not silently choose

On **any** conflict — between these documents, between a document and an explicit
user request, or between a document and the existing codebase — and on any ambiguity
the documents do not resolve:

1. **Stop and flag it to the developer:** what the conflict is, which
   document(s)/section(s) are in tension, the options, and your recommendation.
2. **Do not pick a side silently** and do not quietly deviate from the standards to
   make something compile or "work".
3. **Wait for the developer's decision** before proceeding on the conflicting point.

When there is no conflict, follow the documents directly without asking.
