// Recomputes the per-user action count for every active push subscription
// and sends a silent Web Push (badge update only) when the count changed.
// Triggered by Postgres from magnify_notify_push(); the trigger sends a
// shared secret in the Authorization header which we verify before doing
// any work.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:sendscott@gmail.com";
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Count logic is intentionally mirrored in context/ActionCountsContext.tsx
// (in-app badge). Keep both in sync when stage rules change.
const HC_STAGES = ["hc_approval", "issue_calling", "ordained", "sustain", "set_apart", "record"];
const SP_PRESIDENCY_ROLES = ["stake_president", "first_counselor", "second_counselor"];
const SP_CLERK_ROLES = ["stake_clerk", "exec_secretary"];

interface Calling {
  id: string;
  type: "ward_calling" | "stake_calling" | "mp_ordination";
  ward_id: string | null;
  stage: string;
  extend_by: string | null;
  sustain_by: string | null;
  set_apart_by: string | null;
  record_by: string | null;
}
interface HcMember { id: string; name: string }
interface HcApproval { calling_id: string; hc_member_id: string; approved: boolean }
interface HcMemberWard { hc_member_id: string; ward_id: string }
interface WardSust { calling_id: string; ward_id: string }
interface Profile { id: string; full_name: string; role: string }
interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_count: number;
}

function computeCountForUser(
  profile: Profile,
  callings: Calling[],
  hcMembers: HcMember[],
  approvalSet: Set<string>,
  hcWardCoverage: Map<string, Set<string>>,
  sustainedWardMap: Map<string, Set<string>>,
): number {
  const myName = profile.full_name;
  const myHcId = hcMembers.find(m => m.name === myName)?.id ?? null;
  const myWards = myHcId ? hcWardCoverage.get(myHcId) ?? new Set<string>() : new Set<string>();
  const inPresidency = SP_PRESIDENCY_ROLES.includes(profile.role);
  const isClerk = SP_CLERK_ROLES.includes(profile.role);

  let count = 0;
  for (const c of callings) {
    if (HC_STAGES.includes(c.stage)) {
      // Only count the assignee for the CURRENT stage. Prior-stage
      // assignees are done — they shouldn't keep accumulating badges.
      const currentAssignee =
        c.stage === "issue_calling" || c.stage === "ordained" ? c.extend_by :
        c.stage === "sustain"   ? c.sustain_by :
        c.stage === "set_apart" ? c.set_apart_by :
        c.stage === "record"    ? c.record_by :
        null;
      if (currentAssignee === myName) {
        count++;
        continue;
      }
      if (c.stage === "hc_approval" && myHcId) {
        const key = `${c.id}:${myHcId}`;
        if (!approvalSet.has(key)) {
          count++;
          continue;
        }
      }
      if (c.stage === "sustain" && myWards.size > 0) {
        if (c.type === "stake_calling") {
          const sustained = sustainedWardMap.get(c.id) ?? new Set<string>();
          let needs = false;
          for (const wid of myWards) {
            if (!sustained.has(wid)) { needs = true; break; }
          }
          if (needs) { count++; continue; }
        } else if (c.ward_id && myWards.has(c.ward_id)) {
          count++;
          continue;
        }
      }
    }
    if (c.stage === "for_approval" && (inPresidency || isClerk)) {
      count++;
    }
  }
  return count;
}

Deno.serve(async (req: Request) => {
  // Auth: only the Postgres trigger (carrying our shared secret) is allowed.
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${INTERNAL_FN_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Pull everything we need in parallel.
  const [callingsRes, hcMembersRes, approvalsRes, hcWardsRes, wardSustRes, subsRes] = await Promise.all([
    supa.from("callings")
      .select("id, type, ward_id, stage, extend_by, sustain_by, set_apart_by, record_by")
      .eq("rejected", false).neq("stage", "complete"),
    supa.from("high_council_members").select("id, name").eq("active", true),
    supa.from("hc_approvals").select("calling_id, hc_member_id, approved"),
    supa.from("hc_member_wards").select("hc_member_id, ward_id"),
    supa.from("ward_sustainings").select("calling_id, ward_id, sustained").eq("sustained", true),
    supa.from("magnify_push_subscriptions").select("id, user_id, endpoint, p256dh, auth, last_count"),
  ]);

  const callings: Calling[] = callingsRes.data ?? [];
  const hcMembers: HcMember[] = hcMembersRes.data ?? [];
  const approvalSet = new Set(
    (approvalsRes.data ?? [])
      .filter((a: HcApproval) => a.approved)
      .map((a: HcApproval) => `${a.calling_id}:${a.hc_member_id}`),
  );
  const hcWardCoverage = new Map<string, Set<string>>();
  for (const row of (hcWardsRes.data ?? []) as HcMemberWard[]) {
    if (!hcWardCoverage.has(row.hc_member_id)) hcWardCoverage.set(row.hc_member_id, new Set());
    hcWardCoverage.get(row.hc_member_id)!.add(row.ward_id);
  }
  const sustainedWardMap = new Map<string, Set<string>>();
  for (const row of (wardSustRes.data ?? []) as WardSust[]) {
    if (!sustainedWardMap.has(row.calling_id)) sustainedWardMap.set(row.calling_id, new Set());
    sustainedWardMap.get(row.calling_id)!.add(row.ward_id);
  }
  const subs: Subscription[] = subsRes.data ?? [];

  if (subs.length === 0) {
    return new Response(JSON.stringify({ subscribers: 0, sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch the relevant profiles in one query.
  const userIds = Array.from(new Set(subs.map(s => s.user_id)));
  const { data: profilesData } = await supa
    .from("profiles")
    .select("id, full_name, role")
    .in("id", userIds);
  const profileMap = new Map<string, Profile>(
    (profilesData ?? []).map((p: Profile) => [p.id, p]),
  );

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    const profile = profileMap.get(sub.user_id);
    if (!profile) continue;

    const newCount = computeCountForUser(profile, callings, hcMembers, approvalSet, hcWardCoverage, sustainedWardMap);

    if (newCount === sub.last_count) continue;

    try {
      // Silent push: payload tells the SW what badge value to set.
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ count: newCount }),
        { TTL: 60 * 60 * 24 },
      );
      await supa.from("magnify_push_subscriptions").update({
        last_count: newCount,
        last_pushed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      // 404/410: subscription is gone (uninstalled or expired). Prune it.
      if (status === 404 || status === 410) {
        await supa.from("magnify_push_subscriptions").delete().eq("id", sub.id);
        pruned++;
      } else {
        console.error("push send failed", { id: sub.id, status, err });
      }
    }
  }

  return new Response(
    JSON.stringify({ subscribers: subs.length, sent, pruned }),
    { headers: { "Content-Type": "application/json" } },
  );
});
