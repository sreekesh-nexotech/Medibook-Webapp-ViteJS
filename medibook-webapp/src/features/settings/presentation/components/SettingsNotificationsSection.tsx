import { Card } from '@/shared/ui/Card';
import { Icon } from '@/shared/ui/Icon';
import { Toggle } from '@/shared/ui/Toggle';

import { SettingsHead } from './SettingsHead';

const PATIENT_COMMS: readonly [string, string, string][] = [
  ['confirm', 'Appointment Confirmation', 'Notify the patient when a booking is confirmed'],
  ['reminder', 'Visit Reminder', 'Remind patients 1 week, 48 h, 24 h and 2 h before their visit'],
];

const ADMIN_ALERTS: readonly [string, string, string][] = [
  ['settleReceived', 'Settlement Received', 'When a Medibook transfer reaches your account'],
  ['settleOverdue', 'Settlement Overdue', 'When an expected settlement is late'],
  ['planLimit', 'Plan Limit Reached', 'When the plan’s user, doctor or storage limit is reached'],
];

/**
 * Settings › Notifications. The backend has no per-hospital notification
 * preferences, so these switches are shown off and disabled with that said
 * plainly. Message wording is Medibook's (templates are platform-only), and
 * Medibook pays for messages — there are no messaging credits (UAT-52).
 */
export function SettingsNotificationsSection() {
  return (
    <>
      <Card pad={14} className="flex items-center gap-2.5">
        <Icon name="info" size={16} className="text-text-muted flex-none" />
        <span className="text-body text-text-muted">
          Notification preferences are not yet available from the server — these switches are not
          saved. Patients currently receive every booking message and reminder.
        </span>
      </Card>
      <Card pad={28}>
        <SettingsHead info="Messages patients receive by SMS, WhatsApp and app notification.">
          Patient Communications
        </SettingsHead>
        {PATIENT_COMMS.map(([key, title, caption]) => (
          <div key={key} className="border-border-soft flex items-center gap-4 border-b py-4">
            <div className="flex-1">
              <div className="text-body text-text-strong font-medium">{title}</div>
              <div className="text-caption text-text-muted">{caption}</div>
            </div>
            <Toggle value={false} onChange={() => undefined} label={title} disabled />
          </div>
        ))}
        <div className="text-caption text-text-muted mt-4 flex items-center gap-1.5">
          <Icon name="megaphone" size={14} /> Message wording is set by Medibook for every hospital.
        </div>
      </Card>
      <Card pad={28}>
        <SettingsHead info="Alerts for the hospital admin about billing and settlements.">
          Admin Alerts
        </SettingsHead>
        {ADMIN_ALERTS.map(([key, title, caption]) => (
          <div key={key} className="border-border-soft flex items-center gap-4 border-b py-4">
            <div className="flex-1">
              <div className="text-body text-text-strong font-medium">{title}</div>
              <div className="text-caption text-text-muted">{caption}</div>
            </div>
            <Toggle value={false} onChange={() => undefined} label={title} disabled />
          </div>
        ))}
      </Card>
    </>
  );
}
