/**
 * Medibook needs a secure context: `crypto.randomUUID()` (idempotency keys and
 * ids) and other browser APIs exist only on https:// or localhost. Opened over
 * plain http on an intranet address, every booking and payment would fail on
 * its own (DEP-05), so the app says so up front instead of starting.
 */
export function showInsecureContextNotice(): void {
  const root = document.getElementById('root');
  if (!root) return;
  const secureUrl = `https://${window.location.host}${window.location.pathname}`;

  const page = document.createElement('main');
  page.className = 'bg-bg-app flex min-h-screen items-center justify-center p-5';
  const card = document.createElement('div');
  card.className = 'bg-white max-w-lg rounded-lg border border-border p-8 text-center';
  const title = document.createElement('h1');
  title.className = 'text-h2 text-text-strong mb-3';
  title.textContent = 'Open Medibook over https://';
  const message = document.createElement('p');
  message.className = 'text-body text-text-body mb-5';
  message.textContent =
    'This address is not secure, so bookings and payments cannot be saved. Ask your IT team for the https:// address of Medibook.';
  const link = document.createElement('a');
  link.className = 'text-body text-blue font-semibold underline';
  link.href = secureUrl;
  link.textContent = 'Try the secure address';

  card.append(title, message, link);
  page.append(card);
  root.replaceChildren(page);
}
