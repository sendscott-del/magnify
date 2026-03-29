import { supabase } from './supabase';

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
  memberName, callingName, wardName, fromStage, toStage, toStageKey, performedBy,
}: {
  memberName: string;
  callingName: string;
  wardName?: string | null;
  fromStage: string;
  toStage: string;
  toStageKey: string;
  performedBy?: string | null;
}): Promise<void> {
  const eventType = SP_STAGES.includes(toStageKey) ? 'sp_stage_change' : 'hc_stage_change';

  const { data: settings } = await supabase
    .from('slack_settings')
    .select('webhook_url')
    .eq('active', true)
    .eq('event_type', eventType);

  if (!settings || settings.length === 0) return;

  const wardStr = wardName ? ` (${wardName})` : '';
  const text = `📋 *Magnify Update*\n*${memberName}*${wardStr} — ${callingName}\n${fromStage} → *${toStage}*`;

  for (const s of settings) {
    await postToWebhook(s.webhook_url, text);
  }
}

export async function notifyRejection({
  memberName, callingName, wardName, notes,
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
