# CLAUDE.md — Medibook web app

Project guidance for AI coding agents working anywhere in this repository.

## Authoritative references — read these FIRST, every time

All development is governed by the binding specs in [`docs/`](docs/CLAUDE.md):

1. **[docs/REACT_VITEJS_ARCHITECTURE.md](docs/REACT_VITEJS_ARCHITECTURE.md)** —
   feature-first Clean Architecture: 4 layers (domain → DECLARE, infrastructure →
   DEFINE, application → CALL, presentation → DISPLAY), folder structure, the
   TanStack Query + Zustand split, and the Tailwind v4 styling layer.
2. **[docs/REACT_VITEJS_CODING_STANDARDS.md](docs/REACT_VITEJS_CODING_STANDARDS.md)** —
   naming, strict TypeScript, state-management rules, layer rules, error handling,
   Tailwind v4 styling rules (§8), lint/format gate, dependency policy, and the
   pre-PR checklist (§12).

These take **priority** over your own defaults or patterns from other projects.
Load both into context before starting a task; use the prompt pack in
[docs/REACT_VITEJS_CLAUDE_FEATURE_PROMPTS.md](docs/REACT_VITEJS_CLAUDE_FEATURE_PROMPTS.md)
for feature generation and bug fixes.

## Quick facts (all verified in this repo)

- **Stack:** React 19 + Vite · TypeScript strict · TanStack Query · Zustand · Axios ·
  Zod · React Router · Tailwind CSS **v4** · oxlint + Prettier.
- **Styling:** Tailwind v4 is CSS-first — tokens live in `@theme` in `src/index.css`;
  there is **no** `tailwind.config.js`/`postcss.config.js` and none should be added.
  Conditional classes via `cn()` from `@/shared/lib/cn`. No raw hex, no arbitrary
  `[13px]` values, no new `.css` files.
- **Imports:** use the `@/` alias (wired in `vite.config.ts` + `tsconfig.app.json`),
  never `../../..` chains.
- **QA gate (all must pass, zero errors/warnings):**
  `npm run lint` · `npm run typecheck` · `npm run format:check` · `npm test` · `npm run build`.
  CI runs the same gate plus `npm audit` on every pull request.
  Bare `npx tsc --noEmit` **false-passes** here (solution-style root tsconfig) —
  always use `npm run typecheck`.

## Conflict policy

On any conflict between the docs, the codebase, and a user request — or any
ambiguity the docs don't resolve — **stop and flag it** with options and a
recommendation. Never silently deviate from the standards to make something "work".
