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

// Returns the webhooks for the FIRST event type in `eventTypes` that has an
// active webhook configured — a priority list, not a union. Used to route an
// event to a dedicated channel when one is set up, falling back to a broader
// channel when it isn't.
async function webhooksFor(eventTypes: string[]): Promise<string[]> {
  const { data } = await supabase
    .from('slack_settings')
    .select('event_type, webhook_url')
    .eq('active', true)
    .in('event_type', eventTypes);
  if (!data?.length) return [];
  for (const eventType of eventTypes) {
    const urls = data
      .filter(s => s.event_type === eventType && s.webhook_url)
      .map(s => s.webhook_url as string);
    if (urls.length) return urls;
  }
  return [];
}

// One-tap approval-queue reminders (buttons on the HC / SP boards, admin-only).
// These go to the council's own channel (`hc_reminder` / `sp_reminder`), NOT the
// busy callings channel the stage-change feed posts to. If no reminder webhook is
// configured, they fall back to the board channel so the buttons still do something.
export async function notifyHcApprovalReminder(count: number, requestedBy: string): Promise<void> {
  const urls = await webhooksFor(['hc_reminder', 'hc_stage_change']);
  if (!urls.length) return;
  const linkStr = APP_URL ? `\n<${APP_URL}/hc|Open the HC Board>` : '';
  const text = `:bell: *Reminder from ${requestedBy}:* ${count} calling${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} waiting in the High Council approval queue. Please open Magnify and make your approvals.${linkStr}`;
  for (const url of urls) await postToWebhook(url, text);
}

export async function notifySpApprovalReminder(count: number, requestedBy: string): Promise<void> {
  const urls = await webhooksFor(['sp_reminder', 'sp_stage_change']);
  if (!urls.length) return;
  const linkStr = APP_URL ? `\n<${APP_URL}/board|Open the SP Board>` : '';
  const text = `:bell: *Reminder from ${requestedBy}:* ${count} calling${count === 1 ? '' : 's'} ${count === 1 ? 'is' : 'are'} in the Stake Presidency approval queue. Please open Magnify and approve.${linkStr}`;
  for (const url of urls) await postToWebhook(url, text);
}

export async function notifyStageChange({
  memberName, callingName, wardName, fromStage, toStage, toStageKey, performedBy, callingId, assigneeName,
}: {
  memberName: string;
  callingName: string;
  wardName?: string | null;
  fromStage: string;
  toStage: string;
  toStageKey: string;
  performedBy?: string | null;
  callingId?: string | null;
  assigneeName?: string | null;
}): Promise<void> {
  const eventType = SP_STAGES.includes(toStageKey) ? 'sp_stage_change' : 'hc_stage_change';

  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', eventType);

  if (!settings || settings.length === 0) return;

  // Look up the assignee's Slack user ID for @mention
  let slackUserId: string | null = null;
  if (assigneeName) {
    const [{ data: spData }, { data: hcData }] = await Promise.all([
      supabase.from('sp_members').select('slack_user_id').eq('name', assigneeName).eq('active', true).maybeSingle(),
      supabase.from('high_council_members').select('slack_user_id').eq('name', assigneeName).eq('active', true).maybeSingle(),
    ]);
    slackUserId = spData?.slack_user_id ?? hcData?.slack_user_id ?? null;
  }

  const wardStr = wardName ? ` (${wardName})` : '';
  const byStr = performedBy ? `\nChanged by: *${performedBy}*` : '';
  const assigneeStr = assigneeName
    ? `\nAssigned to: ${slackUserId ? `<@${slackUserId}>` : `*${assigneeName}*`}`
    : '';
  const linkStr = (APP_URL && callingId) ? `\n<${APP_URL}/calling/${callingId}|View Card>` : '';
  const text = `📋 *Magnify Update*\n*${memberName}*${wardStr} — ${callingName}\n${fromStage} → *${toStage}*${byStr}${assigneeStr}${linkStr}`;

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

export async function notifyNewCallingPosted({
  memberName, callingName, wardName, submittedBy, stage,
}: {
  memberName: string;
  callingName: string;
  wardName?: string | null;
  submittedBy: string;
  stage: string;
}): Promise<void> {
  // Posts to the SP board channel only (#stakepresidencycallings) — SP is
  // authorized to see names/callings. NOT the presidency's own channel.
  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', 'sp_stage_change');

  if (!settings || settings.length === 0) return;

  const wardStr = wardName ? ` (${wardName})` : '';
  const text = `📋 *Magnify: New Calling Submitted*\n*${memberName}*${wardStr} — ${callingName}\nSubmitted by *${submittedBy}* → *${stage}*`;

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
    .eq('event_type', 'user_access_request');

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
    .eq('event_type', 'user_access_approved');

  if (!settings || settings.length === 0) return;

  const text = `✅ *Magnify: Access Approved*\n*${name}* (${email}) has been approved as *${role}*`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}

export async function notifySuggestion({
  suggestion, submittedBy,
}: {
  suggestion: string;
  submittedBy: string;
}): Promise<void> {
  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', 'sp_stage_change');

  if (!settings || settings.length === 0) return;

  const text = `💡 *Magnify: Suggestion*\nFrom *${submittedBy}*:\n> ${suggestion}`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}
