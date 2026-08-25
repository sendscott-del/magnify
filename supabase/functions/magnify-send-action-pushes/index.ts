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
  interview_by: string | null;
  extend_by: string | null;
  sustain_by: string | null;
  set_apart_by: string | null;
  record_by: string | null;
  created_by: string | null;
  stake_id: string;
}
type SpApprovalMap = Record<string, { stake_president?: boolean; first_counselor?: boolean; second_counselor?: boolean }>;
interface HcMember { id: string; name: string; stake_id: string }
interface HcApproval { calling_id: string; hc_member_id: string; approved: boolean }
interface HcMemberWard { hc_member_id: string; ward_id: string }
interface WardSust { calling_id: string; ward_id: string }
interface Profile { id: string; full_name: string; role: string; language?: string | null }
interface NativeToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  last_count: number;
}
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
  userStakeId: string | null,
  callings: Calling[],
  hcMembers: HcMember[],
  approvalSet: Set<string>,
  hcWardCoverage: Map<string, Set<string>>,
  sustainedWardMap: Map<string, Set<string>>,
  spApprovalMap: SpApprovalMap,
): number {
  // Stake isolation: only this user's stake counts toward their badge. A user
  // with no stake mapping gets 0 (they shouldn't see any rows in-app either).
  if (!userStakeId) return 0;
  const myName = profile.full_name;
  const myId = profile.id;
  const myRole = profile.role;
  const myHcId = hcMembers.find(m => m.name === myName && m.stake_id === userStakeId)?.id ?? null;
  const myWards = myHcId ? hcWardCoverage.get(myHcId) ?? new Set<string>() : new Set<string>();

  let count = 0;
  for (const c of callings) {
    if (c.stake_id !== userStakeId) continue;
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
    // For Approval → each SP member is owed until they've approved; the
    // president's sign-off is last and only surfaces once BOTH counselors have
    // approved. Clerk/exec-sec are optional and not badged. (Mirrors
    // ActionCountsContext.)
    if (c.stage === "for_approval") {
      const appr = spApprovalMap[c.id] ?? {};
      if (myRole === "first_counselor" && !appr.first_counselor) count++;
      else if (myRole === "second_counselor" && !appr.second_counselor) count++;
      else if (myRole === "stake_president" && appr.first_counselor && appr.second_counselor && !appr.stake_president) count++;
    } else if (c.stage === "pending_interview") {
      // Pending Interview → the assigned presidency member owes the interview.
      // Unassigned should be unreachable (the advance gate requires it), so the
      // fallback only stops a stray card sitting unnoticed. (Mirrors
      // ActionCountsContext.)
      if (c.interview_by) {
        if (c.interview_by === myName) count++;
      } else if (myRole === "stake_president" || myRole === "first_counselor" || myRole === "second_counselor") {
        count++;
      }
    } else if (c.stage === "ideas") {
      // New idea → only the Stake President advances Ideas. Badge him for ideas
      // he didn't submit himself; never his own.
      if (myRole === "stake_president" && c.created_by !== myId) count++;
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
      .select("id, type, ward_id, stage, interview_by, extend_by, sustain_by, set_apart_by, record_by, created_by, stake_id")
      .eq("rejected", false).neq("stage", "complete"),
    supa.from("high_council_members").select("id, name, stake_id").eq("active", true),
    supa.from("hc_approvals").select("calling_id, hc_member_id, approved"),
    supa.from("hc_member_wards").select("hc_member_id, ward_id"),
    supa.from("ward_sustainings").select("calling_id, ward_id, sustained").eq("sustained", true),
    supa.from("magnify_push_subscriptions").select("id, user_id, endpoint, p256dh, auth, last_count"),
  ]);
  const { data: spApprovalsData } = await supa
    .from("stake_presidency_approvals")
    .select("calling_id, role, approved");
  const spApprovalMap: SpApprovalMap = {};
  for (const a of (spApprovalsData ?? []) as Array<{ calling_id: string; role: string; approved: boolean }>) {
    (spApprovalMap[a.calling_id] ??= {})[a.role as "stake_president" | "first_counselor" | "second_counselor"] = a.approved;
  }
  const { data: nativeTokensData } = await supa
    .from("magnify_native_push_tokens")
    .select("id, user_id, token, platform, last_count");
  const nativeTokens: NativeToken[] = nativeTokensData ?? [];

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

  if (subs.length === 0 && nativeTokens.length === 0) {
    return new Response(JSON.stringify({ subscribers: 0, sent: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Fetch the relevant profiles + stake mappings in one query each.
  const userIds = Array.from(new Set([...subs.map(s => s.user_id), ...nativeTokens.map(n => n.user_id)]));
  const [{ data: profilesData }, { data: stakesData }] = await Promise.all([
    supa.from("profiles").select("id, full_name, role, language").in("id", userIds),
    supa.from("user_stakes").select("user_id, stake_id").in("user_id", userIds),
  ]);
  const profileMap = new Map<string, Profile>(
    (profilesData ?? []).map((p: Profile) => [p.id, p]),
  );
  const stakeMap = new Map<string, string>(
    (stakesData ?? []).map((r: { user_id: string; stake_id: string }) => [r.user_id, r.stake_id]),
  );

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    const profile = profileMap.get(sub.user_id);
    if (!profile) continue;

    const newCount = computeCountForUser(profile, stakeMap.get(sub.user_id) ?? null, callings, hcMembers, approvalSet, hcWardCoverage, sustainedWardMap, spApprovalMap);

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

  // ── Native (Expo Push API) ────────────────────────────────────────────────
  // Badge always updates; a visible banner only when the count INCREASED
  // (something new needs the user), never on decreases.
  let nativeSent = 0;
  let nativePruned = 0;
  const expoMessages: { message: Record<string, unknown>; row: NativeToken; newCount: number }[] = [];
  for (const nt of nativeTokens) {
    const profile = profileMap.get(nt.user_id);
    if (!profile) continue;
    const newCount = computeCountForUser(profile, stakeMap.get(nt.user_id) ?? null, callings, hcMembers, approvalSet, hcWardCoverage, sustainedWardMap, spApprovalMap);
    if (newCount === nt.last_count) continue;
    const es = (profile.language ?? "en") === "es";
    const message: Record<string, unknown> = { to: nt.token, badge: newCount };
    if (newCount > nt.last_count) {
      message.title = "Magnify";
      message.body = es
        ? `${newCount} llamamiento${newCount === 1 ? "" : "s"} necesita${newCount === 1 ? "" : "n"} su atención`
        : `${newCount} calling${newCount === 1 ? "" : "s"} need${newCount === 1 ? "s" : ""} your action`;
      message.sound = "default";
      if (nt.platform === "android") message.channelId = "default";
    }
    expoMessages.push({ message, row: nt, newCount });
  }

  for (let i = 0; i < expoMessages.length; i += 100) {
    const chunk = expoMessages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk.map(c => c.message)),
      });
      const json = await res.json();
      const tickets: Array<{ status: string; details?: { error?: string } }> = json?.data ?? [];
      for (let j = 0; j < chunk.length; j++) {
        const ticket = tickets[j];
        const { row, newCount } = chunk[j];
        if (ticket?.status === "ok") {
          await supa.from("magnify_native_push_tokens").update({
            last_count: newCount,
            last_pushed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", row.id);
          nativeSent++;
        } else if (ticket?.details?.error === "DeviceNotRegistered") {
          await supa.from("magnify_native_push_tokens").delete().eq("id", row.id);
          nativePruned++;
        } else {
          console.error("expo push failed", { id: row.id, ticket });
        }
      }
    } catch (err) {
      console.error("expo push batch failed", err);
    }
  }

  return new Response(
    JSON.stringify({ subscribers: subs.length, sent, pruned, nativeTokens: nativeTokens.length, nativeSent, nativePruned }),
    { headers: { "Content-Type": "application/json" } },
  );
});
