# Handling an incident

What to do when the web app is down, broken for everyone, or broken for one hospital
(checklist DOC-01). Error reports, support references and alerts are described in
[`MONITORING.md`](MONITORING.md); hosting and rolling back in
[`DEPLOYMENT.md`](DEPLOYMENT.md). Backend incidents follow the backend repository's
`docs/OPERATIONS.md`.

## 1. How serious is it

| Level  | Examples                                                                           | Response                        |
| ------ | ---------------------------------------------------------------------------------- | ------------------------------- |
| Page   | The app does not load; nobody can sign in; bookings or payments fail everywhere    | Now, whatever the hour          |
| Urgent | One hospital cannot work; live updates have stopped; downloads or uploads all fail | Within the working hour         |
| Ticket | One screen or one person; a workaround exists                                      | Next working day, through a fix |

## 2. First five minutes

1. **Is the app up?** Run the deploy checks against production:

   ```bash
   scripts/check-deployment.sh https://<app host>
   ```

   They cover https, headers, `index.html`, the bundles and the API's health endpoint.

2. **Which alerts are firing?** `WebAppDown`, `WebStaticFilesDown`,
   `WebSocketRouteDown`, `WebChecksMissing` or `WebCertificateExpiring` (web app,
   [`MONITORING.md`](MONITORING.md) §4), and the backend's own API alerts.

3. **What do error reports say?** In the monitor, filter by `release`, `commit` and
   `path`. A jump right after a deploy points at that release.

4. **Did it start with a deploy?** My Account shows the version and commit each user
   runs; compare with the release that went out.

## 3. Roll back first, investigate second

If the problem started with a release, roll back before looking for the cause
([`DEPLOYMENT.md`](DEPLOYMENT.md) §5):

```bash
# on the web server
ln -sfn /srv/medibook-web/releases/<previous version> /srv/medibook-web/current
sudo nginx -s reload
scripts/check-deployment.sh https://<app host>
```

`index.html` is never cached, so the next page load gets the older build, and open
tabs move to it the first time they need a file. The backend and the web app deploy
separately: roll back only the side that changed.

## 4. A user reports a problem

1. Ask for the **support reference** on the error message (eight characters, e.g.
   `011c61b1`), the time, the hospital and the screen.
2. Search the backend logs for `request_id` starting with that reference; a crash
   reference is the `id` of a report in the monitor.
3. Ask for the version on My Account if you suspect an old tab.

## 5. Known failures and their fixes

| Symptom                                                  | Cause                                                                        | Fix                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Blank page, or old screens after a deploy                | `index.html` cached, or missing bundles not answered with 404                | Fix the hosting rules in [`DEPLOYMENT.md`](DEPLOYMENT.md) §2; the deploy checks catch both.         |
| "Open Medibook over https://"                            | The app is being served over plain http                                      | Restore TLS and the http-to-https redirect.                                                         |
| "Please update your browser"                             | A browser older than the supported list                                      | [`SUPPORTED_BROWSERS.md`](SUPPORTED_BROWSERS.md); nothing to fix on the server.                     |
| The queue and the bell stop updating                     | The `/ws/` route or the ASGI server is down (`WebSocketRouteDown`)           | Restart the ASGI server; check the proxy's `/ws/` location and its read timeout.                    |
| Every upload fails                                       | The storage bucket refuses the browser's CORS preflight                      | Apply the bucket rule in [`DEPLOYMENT.md`](DEPLOYMENT.md) §4.                                       |
| Downloads are refused                                    | The file host is not the build's `VITE_STORAGE_ORIGIN`                       | Rebuild with the right storage origin; the Content-Security-Policy only allows that host.           |
| PDF downloads say "This isn't available in Medibook yet" | The server cannot render PDFs (it answers 501)                               | Install the PDF renderer on the backend (DEP-06-B in [`BACKEND_BLOCKERS.md`](BACKEND_BLOCKERS.md)). |
| Many users signed out, or "Too many attempts" at sign-in | Rate limits, or the backend sees the proxy's address instead of the client's | Check the proxy's forwarded-address settings (DEP-12-B, SEC-07-B).                                  |

## 6. Tell people

- Tell affected hospitals by phone (the support number in Platform Settings) and keep
  them updated until it is fixed.
- If a hospital raised a ticket, reply in the ops console's Support Tickets inbox;
  replies are emailed to the person who raised it.

## 7. Afterwards

Write down within two working days: the timeline, the cause, what fixed it, and what
will stop it happening again (a test, an alert or a check). If a fix shipped, it gets a
`CHANGELOG.md` entry like any release.
