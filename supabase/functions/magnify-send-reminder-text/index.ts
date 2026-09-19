// Sends the Sunday meeting reminder text through Tidings.
//
// Called from the dashboard's "Send Text Reminder" sheet with the caller's
// Supabase JWT. The function verifies the user, checks they are stake
// presidency or a clerk, refuses a second send for the same Sunday, counts the
// unique reachable recipients across the requested lists, and — unless
// `preview` is set — queues one Tidings message (both list ids in one row, so
// nobody on both lists is texted twice) and logs it to magnify_reminders_sent.
//
// Tidings is a separate Supabase project; its service key lives in the shared
// project's secrets as TIDINGS_SUPABASE_SERVICE_ROLE_KEY (also used by Knit).
// Never call Tidings' send-message function directly: inserting a `queued`
// row is the supported path and the every-minute dispatcher does the rest.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TIDINGS_URL = Deno.env.get("TIDINGS_SUPABASE_URL") ?? "https://jdlykebsqafcngpntxma.supabase.co";
const TIDINGS_KEY = Deno.env.get("TIDINGS_SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ADMIN_ROLES = ["stake_president", "first_counselor", "second_counselor", "stake_clerk", "exec_secretary"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface Body {
  week_id: string;
  body: string;
  lists: Array<"hc" | "sc">;
  preview?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!TIDINGS_KEY) return json({ error: "Tidings is not configured on this server" }, 500);

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Not signed in" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return json({ error: "Not signed in" }, 401);
  const userId = userRes.user.id;

  const { data: profile } = await admin.from("profiles")
    .select("role, status, is_demo").eq("id", userId).eq("app", "magnify").maybeSingle();
  if (!profile || profile.status !== "approved" || !ADMIN_ROLES.includes(profile.role) || profile.is_demo) {
    return json({ error: "Only the stake presidency and clerks can send reminders" }, 403);
  }

  let input: Body;
  try { input = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  if (!input.week_id || !input.body || !Array.isArray(input.lists) || !input.lists.length) {
    return json({ error: "week_id, body and lists are required" }, 400);
  }

  // The week must be in the caller's stake.
  const { data: week } = await admin.from("magnify_schedule_weeks").select("id, stake_id, sunday_on").eq("id", input.week_id).maybeSingle();
  if (!week) return json({ error: "Sunday not found" }, 404);
  const { data: membership } = await admin.from("user_stakes").select("stake_id").eq("user_id", userId).eq("stake_id", week.stake_id).maybeSingle();
  if (!membership) return json({ error: "Not your stake" }, 403);

  const { data: settings } = await admin.from("magnify_stake_settings")
    .select("tidings_sender_id, tidings_hc_list_id, tidings_sc_list_id").eq("stake_id", week.stake_id).maybeSingle();
  if (!settings?.tidings_sender_id) return json({ error: "Tidings sender is not set for this stake" }, 400);

  const listIds: string[] = [];
  if (input.lists.includes("hc") && settings.tidings_hc_list_id) listIds.push(settings.tidings_hc_list_id);
  if (input.lists.includes("sc") && settings.tidings_sc_list_id) listIds.push(settings.tidings_sc_list_id);
  if (!listIds.length) return json({ error: "No Tidings list is set for those meetings" }, 400);

  // Double-send guard: one text per Sunday.
  const { data: already } = await admin.from("magnify_reminders_sent")
    .select("id, sent_at, recipient_count").eq("week_id", week.id).eq("channel", "tidings").limit(1);
  if (already?.length) {
    return json({ error: "already_sent", sent_at: already[0].sent_at, recipient_count: already[0].recipient_count }, 409);
  }

  // Unique reachable recipients across the lists (the dispatcher dedupes by
  // phone and drops opt-outs the same way, so this is the number that goes out).
  const tidings = createClient(TIDINGS_URL, TIDINGS_KEY, { auth: { persistSession: false } });
  const { data: members, error: memErr } = await tidings.from("list_members")
    .select("contact_id, contacts(phone, opted_out)").in("list_id", listIds);
  if (memErr) return json({ error: `Tidings read failed: ${memErr.message}` }, 502);
  const phones = new Set<string>();
  for (const m of members ?? []) {
    const c = (m as { contacts?: { phone?: string | null; opted_out?: boolean | null } | null }).contacts;
    if (c?.phone && !c.opted_out) phones.add(c.phone);
  }
  const count = phones.size;

  if (input.preview) return json({ count, list_ids: listIds });
  if (count === 0) return json({ error: "No reachable recipients" }, 400);

  const { data: msg, error: msgErr } = await tidings.from("messages").insert({
    body: input.body,
    sent_by: settings.tidings_sender_id,
    database: "stake",
    list_ids: listIds,
    status: "queued",
    scheduled_at: new Date().toISOString(),
  }).select("id").single();
  if (msgErr) return json({ error: `Tidings refused the message: ${msgErr.message}` }, 502);

  const { data: logged, error: logErr } = await admin.from("magnify_reminders_sent").insert({
    stake_id: week.stake_id,
    week_id: week.id,
    channel: "tidings",
    target: listIds.join(","),
    body: input.body,
    recipient_count: count,
    sent_by: userId,
  }).select("id, week_id, channel, target, recipient_count, sent_at").single();
  if (logErr) {
    // The text is queued; report the log failure so it is not silently lost.
    return json({ count, tidings_message_id: msg.id, log_error: logErr.message });
  }

  return json({ count, tidings_message_id: msg.id, reminder: logged });
});
