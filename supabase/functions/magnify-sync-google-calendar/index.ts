// Syncs the stake presidency Google Calendar into magnify_calendar_events.
//
// Reads the calendar's secret iCal address from MAGNIFY_GCAL_ICS_URL (a
// Supabase secret; never stored in a table), expands recurring events over a
// rolling window, and replaces the window's rows for the stake. Called by
// pg_cron every 30 minutes with the INTERNAL_FN_SECRET bearer token, or by a
// stake admin from the app with their own JWT.
//
// Skipped on purpose: all-day events (holiday markers and "No Meetings"
// blocks), and events the exec-sec agent synced from the old schedule sheet
// (their description carries the sync marker) — those are already schedule
// rows in Magnify and would duplicate.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import ical from "npm:node-ical@0.18.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET") ?? "";
const ICS_URL = Deno.env.get("MAGNIFY_GCAL_ICS_URL") ?? "";
// One stake for now; the secret is per project. A second stake gets its own
// secret name and a stake_id → secret map here.
const STAKE_ID = Deno.env.get("MAGNIFY_GCAL_STAKE_ID") ?? "5ad851a1-f94d-4afb-b539-8d27e56c51b2";

const ADMIN_ROLES = ["stake_president", "first_counselor", "second_counselor", "stake_clerk", "exec_secretary"];
const SHEET_MARKER = "Synced from the Chicago Stake Leadership Meetings sheet";
const PAST_DAYS = 14;
const FUTURE_DAYS = 180;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

interface Row {
  stake_id: string; source: string; source_id: string; title: string;
  starts_at: string; ends_at: string; all_day: boolean; location: string | null; description: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  if (!ICS_URL) return json({ error: "MAGNIFY_GCAL_ICS_URL is not set" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let allowed = INTERNAL_FN_SECRET && token === INTERNAL_FN_SECRET;
  if (!allowed && token) {
    const { data: userRes } = await admin.auth.getUser(token);
    if (userRes?.user) {
      const { data: profile } = await admin.from("profiles").select("role, status").eq("id", userRes.user.id).eq("app", "magnify").maybeSingle();
      const { data: membership } = await admin.from("user_stakes").select("stake_id").eq("user_id", userRes.user.id).eq("stake_id", STAKE_ID).maybeSingle();
      allowed = !!profile && profile.status === "approved" && ADMIN_ROLES.includes(profile.role) && !!membership;
    }
  }
  if (!allowed) return json({ error: "Not allowed" }, 403);

  const res = await fetch(ICS_URL);
  if (!res.ok) return json({ error: `Calendar fetch failed: ${res.status}` }, 502);
  const text = await res.text();
  const parsed = ical.sync.parseICS(text);

  const now = new Date();
  const windowStart = new Date(now.getTime() - PAST_DAYS * 86400000);
  const windowEnd = new Date(now.getTime() + FUTURE_DAYS * 86400000);

  const rows: Row[] = [];
  // Overrides of a recurring instance come as their own VEVENT with a
  // RECURRENCE-ID; node-ical attaches them to the master under `recurrences`.
  for (const key of Object.keys(parsed)) {
    const ev = parsed[key] as any;
    if (!ev || ev.type !== "VEVENT") continue;
    if (typeof ev.description === "string" && ev.description.includes(SHEET_MARKER)) continue;
    const allDay = ev.datetype === "date";
    if (allDay) continue;

    const durationMs = (new Date(ev.end).getTime() - new Date(ev.start).getTime()) || 3600000;
    const pushRow = (start: Date, uidSuffix: string, override?: any) => {
      const src = override ?? ev;
      const s = override ? new Date(override.start) : start;
      const e = override ? new Date(override.end) : new Date(start.getTime() + durationMs);
      if (e < windowStart || s > windowEnd) return;
      if (src.status === "CANCELLED") return;
      rows.push({
        stake_id: STAKE_ID, source: "google", source_id: `${ev.uid}|${uidSuffix}`,
        title: String(src.summary ?? ev.summary ?? "(untitled)").trim(),
        starts_at: s.toISOString(), ends_at: e.toISOString(), all_day: false,
        location: src.location ? String(src.location) : null,
        description: src.description ? String(src.description).slice(0, 500) : null,
      });
    };

    if (ev.rrule) {
      const dates: Date[] = ev.rrule.between(windowStart, windowEnd, true);
      const exdates = new Set(Object.keys(ev.exdate ?? {}));
      for (const d of dates) {
        const dayKey = d.toISOString().slice(0, 10);
        if ([...exdates].some(x => x.startsWith(dayKey))) continue;
        const override = ev.recurrences ? Object.values(ev.recurrences).find((r: any) => new Date(r.recurrenceid).toISOString().slice(0, 10) === dayKey) : undefined;
        pushRow(d, d.toISOString(), override);
      }
    } else {
      pushRow(new Date(ev.start), new Date(ev.start).toISOString());
    }
  }

  // Replace the window: delete rows in the window not in this pull, upsert the rest.
  const ids = new Set(rows.map(r => r.source_id));
  const { data: existing } = await admin.from("magnify_calendar_events")
    .select("id, source_id").eq("stake_id", STAKE_ID).eq("source", "google")
    .gte("starts_at", windowStart.toISOString()).lte("starts_at", windowEnd.toISOString());
  const stale = (existing ?? []).filter(e => !ids.has(e.source_id)).map(e => e.id);
  if (stale.length) await admin.from("magnify_calendar_events").delete().in("id", stale);
  if (rows.length) {
    const { error } = await admin.from("magnify_calendar_events").upsert(
      rows.map(r => ({ ...r, synced_at: now.toISOString() })), { onConflict: "stake_id,source,source_id" });
    if (error) return json({ error: error.message }, 500);
  }
  await admin.from("magnify_stake_settings").update({ calendar_synced_at: now.toISOString() }).eq("stake_id", STAKE_ID);
  return json({ upserted: rows.length, removed: stale.length });
});
