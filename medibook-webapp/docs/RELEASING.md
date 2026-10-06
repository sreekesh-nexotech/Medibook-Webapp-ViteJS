# Releasing the Medibook web app

How code reaches `main`, how it is tested, and how a release is cut. Deployment and
rollback depend on the hosting guide (checklist DEP-01), which does not exist yet.

## Branches and pull requests

- Work happens on a branch and reaches `main` only through a reviewed pull request.
- Protect `main` on GitHub (Settings → Branches → Add branch ruleset):
  - require a pull request with at least one approving review;
  - require the **QA gate** status check, and **Browser smoke tests** once staging
    is configured;
  - require branches to be up to date before merging;
  - block force pushes and deletions, and do not allow bypassing.
- Dependabot opens weekly pull requests for npm packages and GitHub Actions. Review
  them like any other change (coding standards §11).

## The QA gate

CI (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`:

| Step              | Command                        |
| ----------------- | ------------------------------ |
| Lint              | `npm run lint`                 |
| Typecheck         | `npm run typecheck`            |
| Format            | `npm run format:check`         |
| Unit and contract | `npm test`                     |
| Build             | `npm run build`                |
| Dependency audit  | `npm audit --audit-level=high` |
| Browser smoke     | `npm run e2e` (staging only)   |

Run the same commands locally before opening a pull request.

## Tests

### Unit tests (`npm test`)

Vitest, next to the code they test (`*.test.ts`). They run in India Standard Time,
because the date helpers work on the hospital's calendar day.

### API contract tests (`npm test`)

`src/test/contract/apiContract.test.ts` parses real backend responses with the
schemas the app uses, so a backend change that breaks a screen fails CI first. The
responses live in `src/test/contract/fixtures/` and are recorded, read-only, by:

```bash
FIXTURE_API_BASE=http://localhost:5173/api/v1 \
FIXTURE_HOSPITAL_EMAIL=<hospital admin> \
FIXTURE_PLATFORM_EMAIL=<platform owner> \
FIXTURE_PASSWORD=<password> \
node scripts/record-api-fixtures.mjs
```

Re-record after a backend release and review the diff. The recorder scrubs
GSTIN, PAN, bank and phone numbers, IP addresses, user agents, other people's email
addresses, and URL hosts, because the repository is committed. Check the diff for
anything it missed before committing.

A coverage test reads the API modules and fails when a new GET endpoint has no
recorded response. Add the endpoint to the recorder, or list it in
`NOT_RECORDED` with the reason.

### Browser smoke tests (`npm run e2e`)

Playwright signs in once as a hospital admin, a receptionist and a platform owner,
opens every screen each can reach, and fails on any API error, page error or
"didn't load" state. Read-only. Configure with `E2E_BASE_URL`, `E2E_API_BASE` (when
the API is on another origin), `E2E_ADMIN_EMAIL`, `E2E_RECEPTION_EMAIL`,
`E2E_PLATFORM_EMAIL` and `E2E_PASSWORD`; without them the tests are skipped. In CI,
set the same names as repository variables (the password as a secret).

Screens that fail for a known backend reason are marked with the checklist item
(`knownFailure`). The test then fails when such a screen starts working, so the
marker is removed with the fix.

Sign-in is rate-limited per account (five a minute), so leave a minute between runs.

## Cutting a release

1. Merge everything for the release into `main` through pull requests.
2. Move the `Unreleased` entries in `CHANGELOG.md` under a new version heading with
   today's date, and set the same version in `package.json` (`npm version <x.y.z>
--no-git-tag-version`).
3. Merge that change, then tag the merge commit and push the tag:

   ```bash
   git tag -a v<x.y.z> -m "Medibook web app v<x.y.z>"
   git push origin v<x.y.z>
   ```

4. Deploy the tagged commit. The build stamps its version and commit, and My
   Account shows them; support uses them to tell which release a hospital runs.

## After a deploy

An open tab reloads itself once when a screen's code file has gone (the new
deploy replaced it), so staff do not have to clear their cache. Hosting must
serve `index.html` without caching for this to pick up the new build (DEP-01).
