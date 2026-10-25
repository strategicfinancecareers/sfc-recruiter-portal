-- SFC's Take now renders on the browse card (pre-intro), which needs the
-- strengths / considerations bullet arrays alongside take + role fit.
-- Both are admin-published, name-scrubbed editorial content — recruiter-safe.
-- CREATE OR REPLACE VIEW: new columns appended at the end only.

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
  c.created_at,
  c.sfc_strengths,
  c.sfc_considerations
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
