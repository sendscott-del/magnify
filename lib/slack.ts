import { supabase } from './supabase';

export async function postToWebhook(webhookUrl: string, text: string): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.warn('[Slack] webhook failed:', e);
  }
}

export async function notifyStageChange({
  memberName,
  callingName,
  wardName,
  fromStage,
  toStage,
  performedBy,
}: {
  memberName: string;
  callingName: string;
  wardName?: string | null;
  fromStage: string;
  toStage: string;
  performedBy?: string | null;
}): Promise<void> {
  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', 'stage_change');

  if (!settings || settings.length === 0) return;

  const wardStr = wardName ? ` (${wardName})` : '';
  const text = `📋 *Magnify Update*\n*${memberName}*${wardStr} — ${callingName}\n${fromStage} → *${toStage}*`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}

export async function notifyRejection({
  memberName,
  callingName,
  wardName,
  notes,
}: {
  memberName: string;
  callingName: string;
  wardName?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', 'rejection');

  if (!settings || settings.length === 0) return;

  const wardStr = wardName ? ` (${wardName})` : '';
  const notesStr = notes ? `\n_Reason: ${notes}_` : '';
  const text = `❌ *Magnify: Rejected*\n*${memberName}*${wardStr} — ${callingName}${notesStr}`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}
