-- Magnify 029 — let stake admins approve a member as stake_council (2026-09-19).
-- Same function as before with the new role in the allow-list; the role
-- itself was added to profiles_role_check in 027.
CREATE OR REPLACE FUNCTION public.magnify_approve_member(p_user_id uuid, p_role text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_role NOT IN ('stake_president','first_counselor','second_counselor',
                    'high_councilor','stake_clerk','exec_secretary','stake_council') THEN
    RAISE EXCEPTION 'magnify_approve_member: invalid role %', p_role;
  END IF;
  IF NOT (
    (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved'
       AND role IN ('stake_president','stake_clerk','exec_secretary'))
     AND user_in_my_stake(p_user_id))
    OR EXISTS (SELECT 1 FROM gather_super_admins WHERE user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'magnify_approve_member: requires an admin of the member''s stake';
  END IF;

  UPDATE profiles SET status = 'approved', role = p_role
  WHERE id = p_user_id AND app = 'magnify';
  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE user_stakes SET role = p_role WHERE user_id = p_user_id;
  RETURN true;
END;
$function$;
