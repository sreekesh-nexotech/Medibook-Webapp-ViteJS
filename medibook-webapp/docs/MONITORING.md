# Monitoring and support

How the web app reports errors, how support finds a problem a user reports, and how
production checks that the app is up. Checklist items OBS-01, OBS-03, OBS-04 and
OBS-05. Hosting is in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 1. Error reports (OBS-01)

The app sends a report when:

| Where                                  | `source`  | What is sent                                          |
| -------------------------------------- | --------- | ----------------------------------------------------- |
| A screen crashes (error boundary)      | `render`  | Error, stack and component stack                      |
| A route fails (router error page)      | `route`   | Error and stack                                       |
| An error nothing caught                | `window`  | Error and stack                                       |
| A promise rejection nothing handled    | `promise` | Error and stack                                       |
| The server answers 5xx                 | `api`     | Status, error code and request id                     |
| A response fails validation            | `api`     | The fields that failed and their Zod codes, no values |
| An API call fails in an unexpected way | `api`     | Error and stack                                       |

Expected failures are not sent: validation errors, permission refusals, not-found,
conflicts, rate limits, being offline, and features the server answers 501 for (not built
in this phase, or PDFs without the renderer; the user sees "This isn't available in
Medibook yet.").

### Turning it on

Build with `VITE_MONITORING_URL` set to an `https://` endpoint that accepts a JSON
`POST`. The build adds its origin to the Content-Security-Policy. Without it nothing is
sent. The endpoint must answer the browser's CORS preflight for the app origin
(`Content-Type` header, `POST`), because the reports are sent from the user's browser.

Any HTTPS endpoint that stores JSON works, for example a log collector's HTTP input
(Vector, Fluent Bit, Logstash) or a monitoring service that accepts JSON events. To use
a vendor's own SDK instead, call it from `src/core/error/monitoring.ts`, the single place
every report goes through.

### Payload

```json
{
  "id": "5f0c2a9e-…",
  "source": "api",
  "name": "server",
  "message": "INTERNAL_ERROR",
  "stack": "…",
  "componentStack": null,
  "path": "/admin/appointments",
  "release": "1.4.0",
  "commit": "accd569",
  "requestId": "011c61b1-…",
  "status": 500,
  "code": "INTERNAL_ERROR",
  "issues": [],
  "occurredAt": "2026-10-06T08:10:22.000Z",
  "userAgent": "Mozilla/5.0 …"
}
```

- **No patient data.** `path` is the screen path without its query string, so search
  terms never leave the browser. An API failure is sent as its code, never the server's
  message, which can quote what the user typed. A validation failure lists field paths,
  never values.
- **Limits.** At most 10 reports a minute per open page, and one report per error, however
  many places catch it. A failed send is dropped silently.

### Source maps

The stack traces point at minified bundles. To read them, build with hidden source maps
and give the maps to the monitor, never to browsers:

```bash
BUILD_SOURCEMAPS=hidden npm run build   # writes dist/assets/*.map, not linked from the bundles
# upload dist/assets/*.map to the monitor, tagged with the release, then:
find dist -name '*.map' -delete
```

The reference nginx config also answers 404 for any `.map` file, and
`scripts/check-deployment.sh` checks that.

## 2. Support references (OBS-04)

Every API request carries an `X-Request-Id`. The backend logs each line for that request
with it (`request_id` in its JSON logs), stores it on audit rows, and echoes it back.

| The user sees                                  | It is                                | Find it in                                       |
| ---------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| "Support reference 011c61b1" on an error state | First 8 characters of the request id | Backend logs: search `request_id` for `011c61b1` |
| The same on an error toast (stays 10 seconds)  | The same                             | The same                                         |
| "Support reference eaf3c55a" on a crash card   | First 8 characters of the report id  | Monitoring: search `id` for `eaf3c55a`           |

Eight characters with the time of the problem and the hospital narrow it to one request.
A crash reference appears only when monitoring is on, since there is nowhere else to look
it up.

## 3. Running version (OBS-03)

My Account shows the version and commit of the running build, and every error report
carries them as `release` and `commit`. The version comes from `package.json` (see
[`RELEASING.md`](RELEASING.md)).

## 4. Uptime alerts (OBS-05)

The backend's Prometheus and Alertmanager (backend: `deploy/prometheus/`) watch the API.
`deploy/monitoring/` adds checks of the web app from outside, with blackbox_exporter:

| File                  | What it is                                                        |
| --------------------- | ----------------------------------------------------------------- |
| `blackbox.yml`        | Probe modules: the app's page, a static file, the WebSocket route |
| `prometheus-web.yml`  | Scrape jobs for those probes (replace the host name)              |
| `web-alerts.yml`      | Alert rules, with the backend's severities                        |
| `web-alerts_test.yml` | Rule tests: `promtool test rules web-alerts_test.yml`             |

| Alert                    | Fires when                                        | Severity |
| ------------------------ | ------------------------------------------------- | -------- |
| `WebAppDown`             | The page has not loaded for 2 minutes             | page     |
| `WebStaticFilesDown`     | A static file has not been served for 2 minutes   | page     |
| `WebSocketRouteDown`     | The `/ws/` handshake has failed for 2 minutes     | page     |
| `WebChecksMissing`       | The checks themselves have not run for 10 minutes | page     |
| `WebCertificateExpiring` | The TLS certificate expires in under 14 days      | ticket   |

The WebSocket check needs no token: the server accepts the handshake (101) and closes the
socket. A 502 or 504 there means the ASGI server or the proxy route is down.

To install: run blackbox_exporter with `blackbox.yml` as `blackbox:9115` beside the
backend's Prometheus, add the jobs in `prometheus-web.yml`, and add `web-alerts.yml` to
`rule_files`. To prove it: on staging, stop the web server, then the WebSocket route, and
check that each pages the on-call person within five minutes.
