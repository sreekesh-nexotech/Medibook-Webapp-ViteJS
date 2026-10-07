# Performance

What the web app asks of the server and the browser, and the limits it keeps to
(checklist PERF-02 to PERF-06). Supported browsers and screens are in
[`SUPPORTED_BROWSERS.md`](SUPPORTED_BROWSERS.md).

## 1. Polling and live updates (PERF-04)

Every request the app repeats on its own. Queries also refresh when a tab regains focus
after their data has gone stale (30 seconds unless the row says otherwise); a screen
that is not open polls nothing.

| What                                                | Who                                                                  | Interval                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------- |
| Admin dashboard (`/hospital/dashboard/admin`)       | Admins: on the dashboard and for the bell                            | 60 s, and on every booking push                             |
| Front-desk dashboard (`/dashboard/reception`)       | Other hospital roles with Dashboard access                           | 60 s, and on every booking push                             |
| Settlement periods (bell)                           | Admins                                                               | On focus, at most once a minute                             |
| Appointment lists that include today                | Anyone on Appointments or Payments                                   | 60 s; queue pushes refresh them, at most once per 2 s burst |
| Doctor sessions (token queue)                       | Anyone on Token Management                                           | 60 s, plus live queue pushes                                |
| Hospital logo, banners, doctor photos               | Screens that show them                                               | 8 min (signed links last 10)                                |
| A file's virus-scan status                          | Right after an upload, until it is clean                             | 2 s                                                         |
| Ops dashboard, plan changes, payable periods (bell) | Ops roles with dashboard, billing or settlements access respectively | On focus, at most every 30–60 s                             |
| Support tickets: list and counts                    | Ops roles with support access, on the inbox                          | 60 s                                                        |
| Support ticket: one ticket and its thread           | Ops roles with support access, on the ticket                         | 30 s                                                        |

Live sockets (`/ws/hospital/alerts`, `/ws/hospital/queue`): a ping every 30 s; after a
drop, reconnects at 1 s doubling to 30 s. Screens that show relative times ("5 min ago")
re-render every 30 s without a request. The session signs out after 15 idle minutes.

A role never polls a source it may not read: a receptionist makes no admin-dashboard
requests, and a role without Dashboard access polls no dashboard at all.

## 2. Large lists (PERF-03)

| List                         | Loaded                                                           | Shown              |
| ---------------------------- | ---------------------------------------------------------------- | ------------------ |
| Users & Roles                | Up to 5,000 staff, re-read at most every 5 min and after an edit | 25 per page        |
| Appointments                 | Up to 5,000 for the range                                        | One page at a time |
| Doctor sessions for a day    | Every page, stopping with a message past 5,000                   | All                |
| Other ops and hospital lists | One server page at a time                                        | One page           |

With 5,000 staff and 2,000 appointments in a day, typing in either screen's search box
on a CPU slowed four times takes at most 80 ms per keystroke (Users & Roles took 744 ms
before it was paged).

## 3. Fonts and files (PERF-02)

Poppins ships as five WOFF2 files (400–800), subset to Latin, punctuation and the rupee
sign: 59 kB in all, down from nine TTF files of 1.44 MB. Other scripts fall back to the
system font. Code is split per screen and cached for a year; see
[`DEPLOYMENT.md`](DEPLOYMENT.md).

## 4. Navigation (PERF-06)

Screens render as soon as their code is loaded; a screen whose data is cached shows it
at once, and each screen shows its own loading state while its data loads.
