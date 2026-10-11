-- Critical security fix, part A (additive — safe to apply before code deploy).
--
-- Context: the legacy policies "Authenticated users can view all candidates"
-- and "Authenticated users can update candidate favorites" let ANY logged-in
-- user read and write every column of every candidates row via the anon-key
-- client. Part A adds the replacement access paths; part B (separate
-- migration, applied after the frontend deploy) drops the legacy policies.

-- 1. Admins keep full read/write on the base table from the browser client
--    (Admin.tsx and SfcTakeEditor rely on direct table access).
create policy "Admins can view all candidates (admin only)"
  on public.candidates for select
  using (public.is_current_user_admin());

create policy "Admins can update candidates"
  on public.candidates for update
  using (public.is_current_user_admin());

-- 2. Recruiter-safe directory view. Mirrors RECRUITER_COLUMNS in
--    src/hooks/useCandidates.ts: NO name, email, phone, linkedin_url,
--    resume paths, sfc_program or sfc_coach.
--    Owned by postgres, so it bypasses candidates RLS; the WHERE clause
--    is the access rule:
--      - caller must be an active admin/owner or an active APPROVED recruiter
--      - row must be an active candidate, OR one the caller holds an
--        approved introduction with (so the post-acceptance full card
--        still renders if the candidate is later deactivated).
create or replace view public.candidate_directory as
select
  c.id,
  c.display_name,
  c.label,
  c.location,
  c.experience,
  c.education,
  c.highest_education_level,
  c.profile_description,
  c.primary_background,
  c.secondary_backgrounds,
  c.open_to_opportunities,
  c.areas_of_expertise,
  c.detailed_experience,
  c.industries,
  c.company_stage_experience,
  c.is_sfc_alum,
  c.sfc_take,
  c.sfc_take_published_at,
  c.sfc_role_fit,
  c.status,
  c.created_at
from public.candidates c
where
  exists (
    select 1
    from public.users u
    join public.roles r on r.id = u.role_id
    where u.id = auth.uid()
      and u.is_active = true
      and (
        r.name in ('admin', 'owner')
        or (r.name = 'recruiter' and u.recruiter_status = 'approved')
      )
  )
  and (
    c.status = 'active'
    or exists (
      select 1 from public.introduction_requests ir
      where ir.candidate_id = c.id
        and ir.requester_id = auth.uid()
        and ir.status = 'approved'
    )
  );

revoke all on public.candidate_directory from anon, public;
grant select on public.candidate_directory to authenticated;
