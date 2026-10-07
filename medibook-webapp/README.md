# Medibook Web App

React + Vite web application built on a feature-first Clean Architecture.

**Stack:** React 19 · Vite · TypeScript (strict) · TanStack Query (server state) ·
Zustand (client state) · Axios · Zod · React Router · Tailwind CSS v4 · oxlint + Prettier

## Getting started

```bash
npm install
cp .env.example .env.local   # then point the dev proxy at a backend
npm run dev
```

The full setup — Node version, running the backend locally or using the shared test
server, seeded sign-ins — is in [`docs/SETUP.md`](docs/SETUP.md).

## Runbooks

| Task                     | Where                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Set up a machine         | [`docs/SETUP.md`](docs/SETUP.md)                                                             |
| Cut a release            | [`docs/RELEASING.md`](docs/RELEASING.md)                                                     |
| Deploy and roll back     | [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §5–6                                              |
| Handle an incident       | [`docs/INCIDENTS.md`](docs/INCIDENTS.md)                                                     |
| Backend gaps and roadmap | [`docs/BACKEND_BLOCKERS.md`](docs/BACKEND_BLOCKERS.md), [`docs/ROADMAP.md`](docs/ROADMAP.md) |

## Scripts

| Script                 | What it does                                     |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | Start the Vite dev server                        |
| `npm run build`        | Type-check (`tsc -b`) and build for production   |
| `npm run lint`         | Lint with oxlint (zero errors/warnings required) |
| `npm run typecheck`    | Type-check only (`tsc -b`)                       |
| `npm run format`       | Format with Prettier (sorts Tailwind classes)    |
| `npm run format:check` | Verify formatting without writing                |
| `npm test`             | Unit and API contract tests (Vitest)             |
| `npm run test:watch`   | The same tests, re-run on save                   |
| `npm run e2e`          | Browser smoke tests (Playwright; needs `E2E_*`)  |
| `npm run preview`      | Preview the production build                     |

`npm run build` needs the API and WebSocket origins (`docs/DEPLOYMENT.md`); for a
local check, set `VITE_API_BASE_URL=same-origin` and `VITE_WS_BASE_URL=same-origin`
in `.env.local` (development treats them like empty values).

All of `lint`, `typecheck`, `format:check`, `test`, and `build` must pass before
merging; CI (`.github/workflows/ci.yml`) runs them, plus `npm audit`, on every pull
request. Releases, tests and fixtures are described in
[`docs/RELEASING.md`](docs/RELEASING.md); building and hosting a release in
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md); error reports and alerts in
[`docs/MONITORING.md`](docs/MONITORING.md); supported browsers in
[`docs/SUPPORTED_BROWSERS.md`](docs/SUPPORTED_BROWSERS.md); polling and list limits in
[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).

## Documentation — read before writing code

The binding specs live in [`docs/`](docs/CLAUDE.md):

- [`docs/REACT_VITEJS_ARCHITECTURE.md`](docs/REACT_VITEJS_ARCHITECTURE.md) — the
  architecture standard (4 layers, folder structure, state-management split,
  Tailwind styling layer).
- [`docs/REACT_VITEJS_CODING_STANDARDS.md`](docs/REACT_VITEJS_CODING_STANDARDS.md) —
  the coding rulebook (naming, TypeScript, state, styling, error handling, QA gate).
- [`docs/REACT_VITEJS_CLAUDE_FEATURE_PROMPTS.md`](docs/REACT_VITEJS_CLAUDE_FEATURE_PROMPTS.md) —
  copy-paste prompts for generating feature layers with Claude Code.
- [`docs/README.md`](docs/README.md) — how to scaffold a new project with
  `docs/scaffold-structure.sh`.

AI coding agents: start at [`CLAUDE.md`](CLAUDE.md).

## Linting notes

Linting uses [oxlint](https://oxc.rs) (config: `.oxlintrc.json`). For type-aware
rules, install `oxlint-tsgolint` and set `"options": { "typeAware": true }` in
`.oxlintrc.json`.
