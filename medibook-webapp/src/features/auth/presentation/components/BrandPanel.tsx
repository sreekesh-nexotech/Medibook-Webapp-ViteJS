/**
 * The auth screens' left brand panel (design `Auth.jsx` `BrandPanel`): a navy
 * gradient with soft geometric circles, the Medibook wordmark, the headline
 * copy and a row of what the panel covers. The design's figures ("288
 * appointments / day", "99.9% uptime") described no real hospital, so the row
 * names features instead (PRD-03).
 */
const FEATURES: readonly (readonly [string, string])[] = [
  ['Front desk', 'Bookings and walk-ins'],
  ['Live queue', 'Tokens update at every desk'],
  ['Accounts', 'Payments and settlements'],
];

export function BrandPanel() {
  return (
    <div className="from-p-500 to-p-600 relative flex shrink-0 grow-0 basis-[44%] flex-col justify-between overflow-hidden bg-linear-160 px-11 py-12 text-white">
      {/* clean geometric depth — soft circles instead of the cross grid */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-37.5 -right-42.5 size-115 rounded-full bg-white/6" />
        <div className="absolute -bottom-17.5 -left-22.5 size-75 rounded-full border border-white/10" />
        <div className="absolute right-14 bottom-32.5 size-37.5 rounded-full bg-white/4" />
      </div>
      <div className="relative flex items-center gap-3">
        <div className="flex size-11.5 items-center justify-center rounded-lg bg-white">
          <img src="/brand/medibook-mark.svg" alt="" className="size-8.5" />
        </div>
        <span className="text-h2 font-bold">Medibook</span>
      </div>
      <div className="relative">
        <div className="mb-4 text-[34px] leading-[1.2] font-bold">
          Hospital operations,
          <br />
          in one calm place.
        </div>
        <p className="text-body m-0 max-w-95 text-white/78">
          Manage appointments, walk-ins, the live token queue, payments and settlements — all from
          the mbAdmin panel.
        </p>
      </div>
      <div className="relative flex gap-7">
        {FEATURES.map(([n, l]) => (
          <div key={n}>
            <div className="text-h3 font-bold text-white">{n}</div>
            <div className="text-caption text-white/70">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
