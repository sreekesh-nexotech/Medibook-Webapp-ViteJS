#!/usr/bin/env bash
# Checks a deployed Medibook web app against docs/DEPLOYMENT.md (DEP-01).
#
#   scripts/check-deployment.sh https://medibook.example.com
#
# Set API_BASE when the API is on another origin (default: the app's own).
# Exits non-zero when any check fails. Read-only: it only sends GET requests.
set -u

base="${1:?Usage: scripts/check-deployment.sh https://<app host>}"
base="${base%/}"
api_base="${API_BASE:-$base}"
failures=0

ok() { printf 'ok    %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; failures=$((failures + 1)); }
# Response headers of a GET, lower-cased names; extra curl options after the URL.
headers() { curl -sS -o /dev/null -D - "${@:2}" "$1" | tr -d '\r' | tr 'A-Z' 'a-z'; }
has() { grep -q -- "$2" <<<"$1"; }

# 1. The app is served over https, and plain http redirects there (DEP-05).
if [[ "$base" != https://* ]]; then
  fail "the app address is not https:// ($base)"
else
  redirect=$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "http://${base#https://}/" 2>/dev/null || true)
  if [[ "$redirect" =~ ^30[18]\ https:// ]]; then ok "http:// redirects to https://"; else fail "http:// does not redirect to https:// ($redirect)"; fi
fi

# 2. index.html: served, never cached, with the security headers.
index=$(headers "$base/")
has "$index" '^http/[0-9.]* 200' && ok "the app answers at the domain root" || fail "GET / is not 200"
has "$index" '^cache-control:.*no-cache' && ok "index.html is revalidated on every load" || fail "index.html lacks Cache-Control: no-cache"
for h in 'content-security-policy:.*frame-ancestors' 'strict-transport-security:' 'x-content-type-options: nosniff' 'referrer-policy:' 'permissions-policy:'; do
  has "$index" "^$h" && ok "header ${h%%:*}" || fail "missing header ${h%%:*}"
done

# 3. A deep link to a screen serves the app (history fallback).
deep=$(curl -sS -o /dev/null -w '%{http_code} %{content_type}' "$base/admin/dashboard")
[[ "$deep" == "200 text/html"* ]] && ok "deep links fall back to index.html" || fail "GET /admin/dashboard gave $deep"

# 4. A hashed bundle: cached for a year and compressed.
bundle=$(curl -sS "$base/" | grep -oE '/assets/[A-Za-z0-9_.-]+\.js' | head -1)
if [ -n "$bundle" ]; then
  asset=$(headers "$base$bundle" -H 'Accept-Encoding: gzip, br')
  has "$asset" '^cache-control:.*immutable' && ok "hashed bundles are cached for a year" || fail "$bundle lacks Cache-Control: immutable"
  has "$asset" '^content-encoding: \(gzip\|br\)' && ok "bundles are compressed" || fail "$bundle is not compressed"
  missing=$(curl -sS -o /dev/null -w '%{http_code}' "$base/assets/no-such-chunk-00000000.js")
  [ "$missing" = 404 ] && ok "a missing bundle is a 404, not index.html" || fail "a missing bundle answered $missing"
  map=$(curl -sS -o /dev/null -w '%{http_code}' "$base$bundle.map")
  [ "$map" = 404 ] && ok "source maps are not served" || fail "$bundle.map answered $map"
else
  fail "no /assets/*.js script in index.html"
fi

# 5. Unhashed public files: cached for a day, fonts compressed.
logo=$(headers "$base/brand/medibook-mark.svg")
has "$logo" '^cache-control:.*max-age=86400' && ok "unhashed files are cached for a day" || fail "/brand/medibook-mark.svg lacks a one-day cache"
font=$(headers "$base/fonts/Poppins-Regular.woff2")
has "$font" '^content-type: font/woff2' && ok "fonts are served as WOFF2" || fail "/fonts/Poppins-Regular.woff2 is missing or has the wrong type"

# 6. The API answers on its origin (same origin by default, DEP-02).
health=$(curl -sS -o /dev/null -w '%{http_code}' "$api_base/api/v1/shared/health")
[ "$health" = 200 ] && ok "the API answers at $api_base/api/v1" || fail "GET $api_base/api/v1/shared/health gave $health"

echo
if [ "$failures" -eq 0 ]; then echo "All checks passed."; else echo "$failures check(s) failed."; fi
echo "Still check by hand: sign in, upload a logo, download a receipt PDF, and call a token on one"
echo "terminal and watch it appear on another within two seconds (DEP-03, DEP-04, DEP-11)."
exit $((failures > 0))
