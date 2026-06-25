-- Add snooze and scheduling support to email_summary_actions.
-- snoozed_until: Unix timestamp. While > now, the action is hidden from the default pending list.
-- scheduled_for: Unix timestamp. When <= now and status = 'pending', background task auto-executes.
ALTER TABLE email_summary_actions ADD COLUMN snoozed_until INTEGER;
ALTER TABLE email_summary_actions ADD COLUMN scheduled_for INTEGER;

CREATE INDEX IF NOT EXISTS idx_email_summary_actions_snoozed_until
  ON email_summary_actions (snoozed_until);
CREATE INDEX IF NOT EXISTS idx_email_summary_actions_scheduled_for
  ON email_summary_actions (status, scheduled_for);
