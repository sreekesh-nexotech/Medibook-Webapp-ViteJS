# Security headers for hosting the web app

The production build already carries a Content-Security-Policy in a `<meta>` tag
(`vite.config.ts`, `cspMetaTag`). It allows the app's own files plus the API,
WebSocket and file-storage origins set at build time (`VITE_API_BASE_URL`,
`VITE_WS_BASE_URL`, `VITE_STORAGE_ORIGIN`). A meta tag cannot carry every
protection, so the host must also send these response headers (checklist SEC-03).

| Header                       | Value                                                          | Why                                                                |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `Content-Security-Policy`    | The meta policy, plus `; frame-ancestors 'none'`               | Stops the console being framed (clickjacking); meta cannot do this |
| `Strict-Transport-Security`  | `max-age=63072000; includeSubDomains; preload`                 | HTTPS only, including the first visit once preloaded               |
| `X-Content-Type-Options`     | `nosniff`                                                      | No content-type guessing                                           |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                              | Paths with MR numbers never leave the site                         |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | The app uses none of these                                         |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                  | Isolates the window from pages it opens                            |

Send them on `index.html` and every file under `/assets`. The policy header and
the meta tag must agree; when the origins change, rebuild with the new
`VITE_*` values and update the header together.

## Example (nginx)

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://files.example.com; font-src 'self'; connect-src 'self' https://api.example.com wss://ws.example.com https://files.example.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'" always;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

## Checking it

- Open the deployed app with the browser console open and use it for a while: any
  `Refused to …` message is a violation to fix before go-live.
- `npm run e2e` against the deployed app fails on any policy violation.
- Check the headers: `curl -sI https://<app>/ | grep -iE 'content-security|strict-transport|x-content-type|referrer-policy|permissions-policy|cross-origin-opener'`.
