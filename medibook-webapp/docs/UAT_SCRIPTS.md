# User acceptance test scripts

Scripts for hospital and operations staff to run on staging before go-live
(checklist REL-05). Each person works through their own script on a normal working
setup (their own PC, browser and printer), marks every step, and signs at the end.
A failed step goes to the engineering lead with a screenshot and the time; it is
either fixed or accepted in writing before go-live.

Use test patients and test money only. Staging must be seeded with one live
hospital, its staff accounts, doctors with sessions for the test day, and an
onboarding hospital for the operations script.

Known blockers before you start: receptionists cannot book or see the queue until
CORE-07 is fixed in the backend (see `docs/BACKEND_BLOCKERS.md`).

## Front desk (receptionist)

| #   | Step                                                                            | Expected                                                               | Pass |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| 1   | Sign in with your account. Leave "Keep me signed in" unticked.                  | The front-desk dashboard opens with today's figures.                   |      |
| 2   | Payments: open your cash drawer with a ₹500 float.                              | "Your cash drawer is open", expected cash ₹500.                        |      |
| 3   | Patients: add a new patient with a mobile number.                               | The patient gets an MR number.                                         |      |
| 4   | New Appointment: book that patient as a walk-in with a doctor in session today. | A booking reference and a token are shown.                             |      |
| 5   | Collect the fee in cash.                                                        | A receipt opens; the drawer's expected cash rises by the fee.          |      |
| 6   | Print the receipt and the token slip on the desk printer.                       | Both print completely on one page each.                                |      |
| 7   | Token Management: call the patient's token.                                     | The token shows as being served.                                       |      |
| 8   | Book a second walk-in and collect by UPI with a reference.                      | Receipt shows UPI and the reference; the drawer total does not change. |      |
| 9   | Payments: find both payments with the search box.                               | Both rows appear with the right method and amount.                     |      |
| 10  | Close your drawer, counting the cash actually in it.                            | The closing shows balanced, short or over, matching your count.        |      |
| 11  | Leave the screen untouched for 15 minutes.                                      | A one-minute warning, then you are signed out (SEC-01).                |      |

## Accounts (accountant)

| #   | Step                                                          | Expected                                                               |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Sign in, then type the Patients address into the browser.     | The dashboard opens; Patients shows "You don't have access" (SEC-09).  |
| 2   | Payments: filter to today, then Paid, then Refunded.          | Each tab shows only matching lines; refunded lines show the refund.    |
| 3   | Export the day's payments to CSV and open it in Excel.        | Amounts and dates match the screen; no cell runs a formula.            |
| 4   | Billing & Settlements: open the latest settlement period.     | Totals match the day's payments less commission and fees.              |
| 5   | Reports: run the revenue report for last month and export it. | The file downloads; large exports arrive by email with a working link. |
| 6   | Open the emailed report link in a signed-out browser.         | Sign-in, then the file downloads (CORE-06).                            |

## Hospital admin

| #   | Step                                                                        | Expected                                                            |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Sign in.                                                                    | The admin dashboard opens.                                          |
| 2   | Doctors & Departments: add a doctor and a weekly schedule.                  | Slots appear in Slots & Availability for the coming days.           |
| 3   | Hospital Settings: add a holiday next week.                                 | Bookings on that day are blocked, and affected patients are listed. |
| 4   | Users & Roles: invite a staff member; accept the invitation from the email. | The new account signs in with the role given.                       |
| 5   | Payments: refund the walk-in paid in cash (needs your own open drawer).     | The refund is recorded and your drawer's expected cash drops.       |
| 6   | Payments: reconcile the receptionist's closed drawer.                       | It leaves the queue.                                                |
| 7   | Hospital Profile: change the logo and the address.                          | The new details show on the next receipt.                           |
| 8   | Audit Trail: find the holiday and the refund.                               | Both entries show who did them and when.                            |

## Operations (platform staff)

| #   | Step                                                                                   | Expected                                                                      |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Sign in to the operations console.                                                     | The ops dashboard opens.                                                      |
| 2   | Onboarding: onboard a new hospital; the administrator accepts the invitation.          | The case moves through the documents to approval.                             |
| 3   | Verify each document, then Go Live with "Open to patients now" on.                     | The hospital is active, listed in the patient app and taking online bookings. |
| 4   | Book that hospital from the patient app.                                               | The booking succeeds and appears at the hospital's front desk.                |
| 5   | Hospitals: change the new hospital's commission from tomorrow and its convenience fee. | The page shows the new terms; the next settlement uses them.                  |
| 6   | Billing: record a payment against an invoice.                                          | The invoice shows paid.                                                       |
| 7   | Settlements: run a payout for last week and release it.                                | The hospital's settlement shows released.                                     |
| 8   | Sign in as a finance-only ops user.                                                    | Only finance screens and actions are offered (SEC-05).                        |

## Sign-off

| Role             | Name | Date | Result (pass / pass with exceptions / fail) | Signature |
| ---------------- | ---- | ---- | ------------------------------------------- | --------- |
| Front desk       |      |      |                                             |           |
| Accounts         |      |      |                                             |           |
| Hospital admin   |      |      |                                             |           |
| Operations       |      |      |                                             |           |
| Engineering lead |      |      |                                             |           |
