/**
 * Every step of report §4, in order, with the title the results file uses.
 * Kept free of Playwright imports: the step reporter (main process) reads it.
 */
export const UAT_STEPS: readonly (readonly [string, string])[] = [
  ['R-1', 'Sign in with "Keep me signed in" off → Front Desk dashboard'],
  ['R-2', 'Payments › open your cash drawer with a ₹500 float'],
  ['R-3', 'Patients › add a patient with a mobile number'],
  ['R-4', 'New Appointment › walk-in with a doctor in session today'],
  ['R-5', 'Collect the fee in cash'],
  ['R-6', 'Print the receipt and the token slip'],
  ['R-7', "Token Management › open the doctor's session and call the patient's token"],
  ['R-8', 'Second walk-in collected by UPI with a reference'],
  ['R-9', 'Appointments › check in a paid online booking'],
  ['R-10', 'No-show only for today; desk cancel stays admin-only (decision 2)'],
  ['R-11', 'Payments › find both payments with the search box'],
  ['R-12', 'Close your drawer, counting the cash in it'],
  ['R-13', 'Help & Support › raise a ticket, then read the reply'],
  ['R-14', 'My Account › change password, revoke a session, sign out everywhere'],
  ['R-15', 'Two tabs for 15 minutes › still signed in while working'],
  ['R-16', 'Forgot password › emailed link › new password signs in'],
  ['Q-1', 'Sign in → Front Desk dashboard'],
  ['Q-2', 'Token Management › every queue command; the next patient can always be called'],
  ['Q-3', 'Second screen › a token cancelled at the desk leaves "Up next"'],
  ['Q-4', 'Online token carries the online marker, desk token the desk marker'],
  ['Q-5', 'Appointments › check in a paid online booking'],
  ['Q-6', 'Walk-in booked, collected at reception (decision 2), checked in'],
  ['C-1', 'Sign in, then type the Patients address → no access'],
  ['C-2', 'Payments › Today, then Paid, then Refunded'],
  ['C-3', "Export the day's payments to CSV, Excel and PDF"],
  ['C-4', 'Refund a UPI payment of a completed booking'],
  ['C-5', 'Billing & Settlements › latest period adds up; statement downloads'],
  ['C-6', 'Plan & Billing › open an invoice; request a plan change'],
  ['C-7', 'Reports › revenue report for last month, exported'],
  ['C-8', 'Large report export › emailed link opened signed out'],
  ['A-1', 'Sign in; switch the dashboard period'],
  ['A-2', 'Doctors & Departments › add, rename and switch off a department'],
  ['A-3', 'Add a doctor with a photo, fees and weekly hours'],
  ['A-4', 'Doctor Availability › weekly session, leave, date exception'],
  ['A-5', 'Slots › block and reopen a slot; bulk-block an afternoon; regenerate'],
  ['A-6', 'Hospital Profile › add a holiday next week, then edit it'],
  ['A-7', 'Hospital Settings › logo and address show on the next receipt'],
  ['A-8', 'Hospital Settings › windows, token scheme, hours, bank account'],
  ['A-9', 'Services & Pricing › service, tax rate, coupon; delete the tax rate (B4)'],
  ['A-10', "Users & Roles › invite, accept from the email, change a role's permissions"],
  ['A-11', 'Payments › refund a cash walk-in from your drawer; reconcile a closed drawer'],
  ['A-12', 'Patients › desk edits a phone (L-09); admin approves only the phone'],
  ['A-13', 'Appointments (Sahyadri) › approve one online request, reject another'],
  ['A-14', 'Messaging › send a reminder; delivery listed with its status'],
  ['A-15', 'Audit Trail › find the holiday and the refund; export'],
  ['A-16', 'Reports › every report from the server; one exported'],
  ['O-1', 'Sign in to the operations console'],
  ['O-2', 'Onboarding › onboard a hospital; its administrator accepts'],
  ['O-3', 'Checklist verified, scan attached, live and open to patients'],
  ['O-4', 'Book the new hospital as a patient; it reaches the front desk'],
  ['O-5', 'Hospitals › commission from tomorrow, convenience fee, suspend, reactivate'],
  ['O-6', 'Plans › create, edit, archive; new plans carry a 14-day trial'],
  ['O-7', 'Billing › reminder sent, grace extended, invoice paid, plan change approved'],
  ['O-8', 'Settlements › payout run created, approved, released'],
  ['O-9', 'Analytics, Reports, Compliance Logs, Compliance follow the filters'],
  ['O-10', 'Users & Roles › new operations user sets a password from the email'],
  ['O-11', 'Platform Users › block and unblock a patient account; logged'],
  ['O-12', 'Notifications › a home-screen banner reaches the patient app'],
  ['O-13', 'Platform Settings › convenience-fee GST and a feature flag'],
  ['P-1', 'Finance sees only finance screens and actions'],
  ['P-2', 'Support works tickets and patient accounts'],
  ['P-3', 'Compliance records a data request, listed with names'],
  ['P-4', 'Read only sees everything and can change nothing'],
];

/** `R-3 …` → `R-3`. */
export const STEP_ID = /^([RQCAOP]-\d+)\b/;

export function stepTitle(id: string): string {
  const found = UAT_STEPS.find(([sid]) => sid === id);
  if (!found) throw new Error(`Unknown UAT step ${id}.`);
  return `${id} ${found[1]}`;
}
