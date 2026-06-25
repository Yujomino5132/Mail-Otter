import type { EmailAction, EmailActionExecution, EmailActionStatus } from '../../components/types';
import { apiFetch, readJson } from '../../components/utils';

export async function loadActions(
  applicationId: string,
  status: EmailActionStatus | '',
  cursor?: string,
  showSnoozed?: boolean,
): Promise<{ actions: EmailAction[]; nextCursor?: string }> {
  const p = new URLSearchParams();
  if (applicationId) p.set('applicationId', applicationId);
  if (status) p.set('status', status);
  if (cursor) p.set('cursor', cursor);
  if (showSnoozed) p.set('showSnoozed', 'true');
  return readJson<{ actions: EmailAction[]; nextCursor?: string }>(await apiFetch(`/user/actions?${p}`));
}

export async function loadActionExecutions(actionId: string): Promise<{ executions: EmailActionExecution[] }> {
  return readJson<{ executions: EmailActionExecution[] }>(
    await apiFetch(`/user/actions/${encodeURIComponent(actionId)}/executions`),
  );
}

export async function executeAction(actionId: string): Promise<{ action: EmailAction }> {
  return readJson<{ action: EmailAction }>(
    await apiFetch(`/user/actions/${encodeURIComponent(actionId)}/execute`, { method: 'POST' }),
  );
}

export async function snoozeAction(actionId: string, snoozedUntil: string | null): Promise<{ action: EmailAction }> {
  return readJson<{ action: EmailAction }>(
    await apiFetch(`/user/actions/${encodeURIComponent(actionId)}/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snoozedUntil }),
    }),
  );
}

export async function scheduleAction(actionId: string, scheduledFor: string | null): Promise<{ action: EmailAction }> {
  return readJson<{ action: EmailAction }>(
    await apiFetch(`/user/actions/${encodeURIComponent(actionId)}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledFor }),
    }),
  );
}
