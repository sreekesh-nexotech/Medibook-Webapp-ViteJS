# Setting up the Medibook web app

From a clean machine to a running app signed in against a backend (checklist DOC-01).
Releasing is in [`RELEASING.md`](RELEASING.md), hosting and rolling back in
[`DEPLOYMENT.md`](DEPLOYMENT.md), and handling an incident in
[`INCIDENTS.md`](INCIDENTS.md).

## 1. What you need

- Node.js 24 or later (`engines` in `package.json`) and npm.
- Git, with access to this repository and the backend repository
  (`Medibook-backend-django`).
- For a backend on your own machine: Docker, `make` and `openssl` (the backend's README
  lists the rest).

## 2. Install

```bash
git clone <this repository>
cd medibook-webapp
npm install
cp .env.example .env.local
```

`.env.local` is git-ignored. Every `VITE_` value is bundled into the app, so it never
holds a secret.

## 3. Point the app at a backend

In development the app calls its own dev server, which forwards `/api` and `/ws` to
the backend (`server.proxy` in `vite.config.ts`). Leave `VITE_API_BASE_URL` and
`VITE_WS_BASE_URL` empty and set only the proxy targets in `.env.local`:

| Backend                                   | `.env.local`                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Docker dev stack (`make dev-up`)          | `VITE_API_PROXY_TARGET=https://localhost:8443`<br>`VITE_WS_PROXY_TARGET=wss://localhost:8443`<br>`VITE_PROXY_INSECURE_TLS=true`    |
| Without Docker (`make run` and `make ws`) | `VITE_API_PROXY_TARGET=http://localhost:8000`<br>`VITE_WS_PROXY_TARGET=ws://localhost:8001` (the defaults in `.env.example`)       |
| The shared test server                    | Its address as the two targets. The address is shared inside the team, not in this repository. Data there is shared with everyone. |

### A backend on your machine

In the backend repository (its `README.md` has the details):

```bash
make dev-init    # once: keys, a self-signed certificate, placeholders
make dev-up      # build, migrate and start everything; the API is https://localhost:8443
make dev-seed    # demo hospitals, staff and patients (about 9 minutes)
```

The seeded logins are written to `var/seed/users.json` in the backend repository, and
every seeded account's password is `seed_password_123`. Use a hospital admin for the
hospital app and a platform owner for the ops console. Reseed with
`make dev-seed-reset`.

## 4. Run

```bash
npm run dev
```

Open `http://localhost:5173` and sign in. Hospital staff use the hospital sign-in; ops
staff switch to the operations console on the sign-in screen.

## 5. Before you open a pull request

```bash
npm run lint
npm run typecheck        # not bare `npx tsc` — it checks nothing here
npm run format:check
npm test
VITE_API_BASE_URL=same-origin VITE_WS_BASE_URL=same-origin npm run build
```

CI runs the same steps plus `npm audit`. Browser smoke tests (`npm run e2e`) need the
`E2E_*` variables in [`RELEASING.md`](RELEASING.md).

## 6. When something is off

| You see                                                      | Why, and what to do                                                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Every request fails, or the console shows a CORS error       | The request went past the dev server. Leave `VITE_API_BASE_URL` empty in development and set `VITE_API_PROXY_TARGET` instead.       |
| `self-signed certificate` in the dev server's terminal       | Set `VITE_PROXY_INSECURE_TLS=true` for the Docker stack's certificate. Never in a build.                                            |
| Live updates never arrive (queue, bell)                      | `VITE_WS_PROXY_TARGET` points nowhere: plain `runserver` serves no WebSockets; run `make ws` or use the Docker stack.               |
| Sign-in says "Too many attempts"                             | The backend allows 5 sign-ins a minute per account. Wait a minute.                                                                  |
| "Open Medibook over https://" on another computer on the LAN | Only the dev server is allowed over plain http. A preview or a build needs https or localhost.                                      |
| `npm run build` stops with "see docs/DEPLOYMENT.md"          | A build needs the API and WebSocket origins: set them as in step 5, or as in [`DEPLOYMENT.md`](DEPLOYMENT.md) §1 for a real deploy. |
