# What the web app does not do yet

Every capability that is not in the web app at launch, whether the backend already
supports it, and what the app does instead (checklist PRD-10). Checked against both
repositories on 7 October 2026.

**Status** is _To decide_ until the product owner gives the item a target date or marks
it _Not at launch_; the **Target** column is theirs to fill. Once it is filled in,
§4 is what hospitals are told.

## 1. The backend supports it; the web app has no screen yet

| Capability                                                                 | For               | Backend                                                                               | The web app today                                                             | Status    | Target |
| -------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------- | ------ |
| Per-doctor prices for a service                                            | Hospital admin    | `hospital/doctor-services` (`price_override_paise`)                                   | One price per service; each doctor has a consultation and a follow-up fee     | To decide |        |
| Who used a coupon                                                          | Hospital admin    | `hospital/coupons/{id}/redemptions`                                                   | The number of uses only                                                       | To decide |        |
| Calling a specific token, recalling one, call history                      | Front desk        | `hospital/sessions/{id}/call`, `/recall`, `/calls`                                    | Call next, skip, start, done, no-show, pause and close                        | To decide |        |
| Queue display boards: register screens, rotate keys                        | Hospital admin    | `hospital/display-devices`, `display/*`                                               | None                                                                          | To decide |        |
| Counters: create, edit, assign staff                                       | Hospital admin    | `hospital/counters`, staff `counter_id`                                               | A staff member's counter is shown on the cash drawer                          | To decide |        |
| Print templates for token slips and receipts                               | Hospital admin    | `hospital/print-templates` (with preview)                                             | Built-in layouts only                                                         | To decide |        |
| Every staff member's cash drawers: daily summary, history                  | Admin, accountant | `hospital/cash-sessions/summary`, list filters, `/{id}`                               | Each person's own drawer, and closed drawers waiting to be reconciled         | To decide |        |
| Holding or failing a payout; settlement adjustments                        | Ops finance       | `platform/settlements/payouts/{id}/hold`, `/fail`, `/adjustments`                     | Payout runs and releases                                                      | To decide |        |
| Scheduled report emails                                                    | Ops               | `platform/report-schedules` (platform-wide and per hospital)                          | None; each hospital's admins get daily Payment and Revenue reports by default | To decide |        |
| Patient-app content: FAQs, legal documents, locations, ambulance providers | Ops               | `platform/faqs`, `legal-documents` (with publish), `locations`, `ambulance-providers` | None (app banners are in Notifications)                                       | To decide |        |
| Moderating doctor reviews                                                  | Ops               | `platform/reviews` with approve and reject                                            | The on/off setting only                                                       | To decide |        |
| Editing message templates                                                  | Ops               | `platform/messaging/templates`                                                        | Hospitals see the templates, read-only                                        | To decide |        |

## 2. Neither the backend nor the web app has it

| Capability                                                                                         | What the app shows instead                                | Status    | Target |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------- | ------ |
| Branches (the backend has no branch concept, D-02)                                                 | "Branches are coming later" on Hospital Profile           | To decide |        |
| Announcements to patients (no endpoint, Q109)                                                      | The Announcements tab says they are not available yet     | To decide |        |
| Writing and scheduling push messages                                                               | Push goes out only on events; the ops tab says so         | To decide |        |
| A hospital's own FAQs                                                                              | Help & Support shows Medibook's FAQs                      | To decide |        |
| Switching individual patient messages or staff emails off                                          | Notifications lists what is always sent                   | To decide |        |
| More gallery photos, and an "about" text for the hospital                                          | The cover photo                                           | To decide |        |
| Inviting staff by mobile OTP, or setting a password for them                                       | Email invitations                                         | To decide |        |
| Inviting more hospital admins from the ops console (CORE-04)                                       | The first admin is invited when the hospital is created   | To decide |        |
| Support email, payout schedule, alerts and a weekly digest, API keys for ops                       | Listed under "Coming later" in Ops Settings               | To decide |        |
| Plan and monthly bookings per hospital; city, bookings, active and new counts for patient accounts | Left out of the ops lists (PRD-05-B)                      | To decide |        |
| A desk fee quote that knows a visit is a follow-up (PRD-07-B)                                      | The bill shows follow-up pricing once the booking is made | To decide |        |
| The person's name in the audit trail for every role (PRD-08-B)                                     | Names where the role can look them up                     | To decide |        |

## 3. Not in this phase — decided in the backend design

| Capability                                  | Decision                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Multi-factor sign-in                        | Off in this phase (Q64); the endpoints answer 501 (SEC-04 in `BACKEND_BLOCKERS.md`). |
| Retrying a subscription payment online      | Billing is manual in phase 1: ops mark invoices paid.                                |
| Rescheduling an appointment                 | Not supported (D-14): cancel and book again.                                         |
| Waiving a fee                               | Not supported (Q96).                                                                 |
| Ops filing a deletion request for a patient | Deletions follow the patient's own account deletion (D-24).                          |

## 4. What to tell hospitals

Once the targets are set, send hospitals two short lists from §1 and §2: what is coming
and when, and what is not planned for launch. Until then, the app itself says "coming
later" wherever one of these would have been, and shows no control that does nothing.
