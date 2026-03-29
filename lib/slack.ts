import { supabase } from './supabase';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL ?? '';

export async function postToWebhook(webhookUrl: string, text: string): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn('[Slack] webhook failed:', e);
  }
}

const SP_STAGES = ['ideas', 'for_approval', 'stake_approved'];

export async function notifyStageChange({
  memberName, callingName, wardName, fromStage, toStage, toStageKey, performedBy, callingId,
}: {
  memberName: string;
  callingName: string;
  wardName?: string | null;
  fromStage: string;
  toStage: string;
  toStageKey: string;
  performedBy?: string | null;
  callingId?: string | null;
}): Promise<void> {
  const eventType = SP_STAGES.includes(toStageKey) ? 'sp_stage_change' : 'hc_stage_change';

  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', eventType);

  if (!settings || settings.length === 0) return;

  const wardStr = wardName ? ` (${wardName})` : '';
  const byStr = performedBy ? `\nChanged by: *${performedBy}*` : '';
  const linkStr = (APP_URL && callingId) ? `\n<${APP_URL}/calling/${callingId}|View Card>` : '';
  const text = `📋 *Magnify Update*\n*${memberName}*${wardStr} — ${callingName}\n${fromStage} → *${toStage}*${byStr}${linkStr}`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}

export async function notifyRejection({
  memberName, callingName, wardName, notes, performedBy, callingId,
}: {
  memberName: string;
  callingName: string;
  wardName?: string | null;
  notes?: string | null;
  performedBy?: string | null;
  callingId?: string | null;
}): Promise<void> {
  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', 'rejection');

  if (!settings || settings.length === 0) return;

  const wardStr = wardName ? ` (${wardName})` : '';
  const notesStr = notes ? `\n_Reason: ${notes}_` : '';
  const byStr = performedBy ? `\nRejected by: *${performedBy}*` : '';
  const linkStr = (APP_URL && callingId) ? `\n<${APP_URL}/calling/${callingId}|View Card>` : '';
  const text = `❌ *Magnify: Rejected*\n*${memberName}*${wardStr} — ${callingName}${notesStr}${byStr}${linkStr}`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}

export async function notifyAccessRequest({
  name, email, role,
}: {
  name: string;
  email: string;
  role: string;
}): Promise<void> {
  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', 'user_access');

  if (!settings || settings.length === 0) return;

  const text = `🆕 *Magnify: Access Requested*\n*${name}* (${email}) has requested access as *${role}*\n_Review pending users in Settings → Manage Users_`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}

export async function notifyAccessApproved({
  name, email, role,
}: {
  name: string;
  email: string;
  role: string;
}): Promise<void> {
  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', 'user_access');

  if (!settings || settings.length === 0) return;

  const text = `✅ *Magnify: Access Approved*\n*${name}* (${email}) has been approved as *${role}*`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}
