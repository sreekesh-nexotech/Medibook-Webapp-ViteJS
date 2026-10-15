# Deploying the Medibook web app

How to build, host, release and roll back the web app (checklist DEP-01). The app
is a static single-page build: a `dist/` folder of HTML, JavaScript, CSS, fonts and
images, with no server code of its own. The backend is deployed separately; the
settings it must have for the browser to work are listed below.

## 1. Build

| Step                 | Command or setting                                             |
| -------------------- | -------------------------------------------------------------- |
| Node                 | The version in `.nvmrc` (24, an LTS line)                      |
| Install              | `npm ci` (exactly the lockfile; never `npm install`)           |
| Settings (see below) | `VITE_API_BASE_URL`, `VITE_WS_BASE_URL`, `VITE_STORAGE_ORIGIN` |
| Build                | `npm run build` → `dist/`                                      |

The settings are fixed into the bundle at build time, so each environment
(staging, production) needs its own build. All of them are public; never put a
secret in a `VITE_` variable.

| Setting               | Value                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`   | `same-origin` when the app's host proxies `/api` (recommended), else `https://<api host>` |
| `VITE_WS_BASE_URL`    | `same-origin` when the app's host proxies `/ws` (recommended), else `wss://<ws host>`     |
| `VITE_STORAGE_ORIGIN` | The file-storage origin signed links point at, e.g. `https://files.medibook.example`      |
| `VITE_MONITORING_URL` | Where error reports are sent (`https://…`); optional, see `docs/MONITORING.md`            |

`npm run build` stops when the API or WebSocket setting is missing or not
`https://`/`wss://` (DEP-10). The build writes a Content-Security-Policy that
allows exactly these origins.

## 2. Hosting rules

Any web server or CDN can host the app if it follows these rules.

| Path                                   | Serve                                           | Cache-Control                         |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| `/assets/*`                            | The file, or **404** when missing               | `public, max-age=31536000, immutable` |
| `/fonts/*`, `/brand/*`, `/favicon.svg` | The file                                        | `public, max-age=86400`               |
| `/api/*`, `/ws/*` (same-origin layout) | Proxied to the backend; WebSockets with upgrade | Set by the backend                    |
| Every other path                       | `index.html` (the app routes in the browser)    | `no-cache`                            |

- **Domain root only.** The app uses absolute paths (`/assets/…`, `/fonts/…`), so it
  must be served at `/`, not under a sub-path.
- **Hashed files.** Everything in `/assets/` has a content hash in its name and can
  be cached for a year. Files without a hash live outside `/assets/`.
- **A missing bundle must 404.** An open tab on an older build asks for that build's
  files; a 404 makes it reload onto the new build once (RUN-01).
- **Compression** for JavaScript, CSS, SVG and JSON (gzip or Brotli); the fonts are
  WOFF2, compressed already.
- **HTTPS only**, with plain http redirected and HSTS set. Over plain http the app
  shows "Open Medibook over https://" instead of starting, because browsers
  withhold the APIs its writes depend on (DEP-05).
- **Security headers** on every response: `docs/SECURITY_HEADERS.md`.

## 3. Reference nginx config

`deploy/nginx/medibook-web.conf` implements the rules above with the same-origin
layout, and `deploy/nginx/medibook-security-headers.conf` holds the headers it
includes (install it as `snippets/medibook-security-headers.conf`). Replace the
server name, certificate paths, upstream addresses and storage origin, then:

```bash
nginx -t && nginx -s reload
```

## 4. Backend settings the web app depends on

Owned by the backend and DevOps; open items are tracked in
`docs/BACKEND_BLOCKERS.md`.

| Setting                                                   | Why the web app needs it                                                                                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Same-origin proxy, or CORS allowlists (DEP-02)            | Cross-origin, every browser call is blocked unless the app origin is allowed, with `Authorization`, `If-Match` and `Idempotency-Key` allowed and `Content-Disposition` exposed. |
| Public HTTPS storage endpoint (DEP-03)                    | Signed upload and download links must point at a host browsers reach over https.                                                                                                |
| Bucket CORS (DEP-04)                                      | Uploads are a cross-origin `PUT` from the app origin (rule below).                                                                                                              |
| `ENVIRONMENT=prod`, live providers (DEP-06)               | Fake providers hand out unreachable links; Razorpay needs live keys; receipt PDFs need the renderer.                                                                            |
| `ALLOWED_HOSTS`                                           | Must name the API host the browser calls.                                                                                                                                       |
| `FRONTEND_HOSPITAL_URL`, `FRONTEND_PLATFORM_URL` (DEP-07) | Invitation, password-reset and report links in emails are built from them.                                                                                                      |
| Email credentials (DEP-07)                                | Sending fails silently without them.                                                                                                                                            |
| `TRUSTED_PROXY_CIDRS` (DEP-12)                            | Rate limits must see each client's real IP; list every proxy and load balancer in front of the API.                                                                             |
| WebSocket route (DEP-11)                                  | `/ws/` to the ASGI server with upgrade headers and a read timeout over 5 minutes.                                                                                               |
| Backups (DEP-09)                                          | The database and the file store, with a tested restore.                                                                                                                         |

Bucket CORS for uploads from the app origin (S3 / MinIO JSON form):

```json
[
  {
    "AllowedOrigins": ["https://medibook.example.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type", "x-amz-checksum-sha256"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 5. Releasing and rolling back

Keep each release in its own directory and point the server at one:

```text
/srv/medibook-web/releases/1.4.0/   ← that build's dist/
/srv/medibook-web/releases/1.4.1/
/srv/medibook-web/current → releases/1.4.1
```

- **Deploy:** copy the new `dist/` to `releases/<version>/`, repoint `current`,
  reload the server. Release steps and versioning are in `docs/RELEASING.md`.
- **Roll back:** repoint `current` at the previous release and reload. Because
  `index.html` is never cached, the next page load gets the older build, and open
  tabs reload onto it the first time they need a file.
- Keep at least the two previous releases.

## 6. After a deploy

Run the automated checks, then the manual ones it lists:

```bash
scripts/check-deployment.sh https://medibook.example.com
```

It checks the https redirect, the security headers, deep links, caching of
`index.html` and the bundles, compression, the 404 for a missing bundle and for
source maps, and that the API answers. Uptime alerts for the app and its WebSocket
route are in `docs/MONITORING.md`. By hand: sign in, upload a hospital logo, download a receipt PDF,
and call a token on one terminal and watch it appear on another within two seconds.
