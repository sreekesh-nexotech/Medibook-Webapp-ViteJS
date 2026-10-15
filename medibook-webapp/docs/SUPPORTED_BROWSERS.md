# Supported browsers and devices

The browsers and screens Medibook is built and tested for (checklist PERF-01). Share
this list with hospitals before go-live.

## Browsers

| Browser                   | Oldest supported version | Released |
| ------------------------- | ------------------------ | -------- |
| Google Chrome             | 111                      | Mar 2023 |
| Microsoft Edge            | 111                      | Mar 2023 |
| Mozilla Firefox           | 128                      | Jul 2024 |
| Safari (macOS and iPadOS) | 16.4                     | Mar 2023 |

Why these: the app's styles (Tailwind CSS v4) use CSS colour mixing and registered
custom properties, which arrived in exactly these versions. The build targets the same
list (`build.target` in `vite.config.ts`).

**Older browsers** see "Please update your browser" with this list instead of a broken
page (`public/browser-check.js`, which runs before the app). That includes every
browser on Windows 7 and 8.1, which stop at Chrome 109.

## Screens

| Device                             | Width          | Layout                                           |
| ---------------------------------- | -------------- | ------------------------------------------------ |
| Desktop and laptop                 | 1280 px and up | Full sidebar; dashboards side by side            |
| Small laptop, tablet in landscape  | 1024–1279 px   | Full sidebar; dashboard panels stacked           |
| Tablet in portrait (iPad, Android) | 768–1023 px    | Icon sidebar; panels stacked                     |
| Phone                              | under 768 px   | Sidebar in a drawer; usable, not a design target |

No screen scrolls sideways at 768, 820, 1024, 1280 or 1366 px; tables that are wider
than their card scroll inside the card.

## Testing

| Check                                                                                      | Where                                                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Every screen on current Chromium and WebKit (Safari)                                       | Automated, each release                                   |
| The update message on a browser without the CSS features                                   | Automated (simulated)                                     |
| Sign-in, a walk-in booking and a receipt on Chrome 111, Firefox 128 and Safari 16.4 (iPad) | Manual, on real devices or a device cloud, before go-live |

The last row is the go-live sign-off for the oldest entries; record the versions tested
in the UAT sheet (`docs/UAT_SCRIPTS.md`).
