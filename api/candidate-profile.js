import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { verifyBearerEmail } from './_shared/verifyBearerEmail.js';

// Admin notify destination + sender; reuses the pattern from
// api/recruiter-signup.js so deliverability + reply behavior match.
const ADMIN_NOTIFY_EMAIL = 'zu@strategicfinancecareers.com';
const FROM_ADDR = 'SFC Talent <noreply@strategicfinancecareers.com>';
const APP_URL = 'https://sfc-recruiter-portal.vercel.app';
const resend = new Resend(process.env.RESEND_API_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// /api/candidate-profile — candidate-self only
//
// SECURITY MODEL
// ──────────────
// This endpoint runs with the service-role key (RLS-bypassing). Until the
// hardening below, it accepted an `email` query param (GET) or a candidate
// `id` (PATCH) with NO caller verification, which meant anyone could fetch
// or update any candidate's row by guessing the address — bypassing the
// entire anonymity model.
//
// Now both methods REQUIRE a valid Supabase access token in the
// Authorization header (Bearer <jwt>). The token is validated against the
// auth server via supabase.auth.getUser(jwt); the verified email is then
// matched (case-insensitive) to the requested candidate's email:
//
//   GET  /api/candidate-profile?email=foo@bar.com
//        → 401 if no/invalid token
//        → 403 if verified email !== requested email
//        → 200 with the candidate's narrowed row otherwise
//
//   PATCH /api/candidate-profile  body: { id, ...fields }
//        → 401 if no/invalid token
//        → 404 if no candidate with that id (or row is deleted)
//        → 403 if verified email !== candidate.email
//        → 200 on successful update otherwise
//
// Candidates have no row in public.users (AuthContext.user is null for
// them by design) but they DO hold a real Supabase auth session — the
// client passes session.access_token through. The match is by email
// because candidates.id is not linked to auth.users.id in this schema;
// candidates.email is the only stable identifier shared with auth.
//
// The recruiter-facing surface (browse / intro request flow) lives on a
// SEPARATE endpoint (/api/recruiter-intros) with its own PII scrub for
// non-approved intros — that surface is not affected by this gate.
// ─────────────────────────────────────────────────────────────────────────────

// Fields returned by GET. Narrowed to only what the dashboard's Profile
// read-view, Edit form, Resume tab, and Settings tab actually consume.
// Dropped from the previous widened set: phone, work_authorized_us,
// requires_sponsorship, education, highest_education_level,
// primary_background, secondary_backgrounds, preferred_cities_other,
// industries_other, target_company_stages, new_areas. Add back here
// (and to the UI) if the dashboard grows to use them. Minimum-fields
// principle: every column in this list is a column we're willing to
// expose to a verified-self candidate.
// education, highest_education_level, primary_background,
// secondary_backgrounds are returned so the dashboard's Recruiter View
// tab can render AnonymousCandidateCard with the same fidelity
// recruiters see on /browse — these columns are ALREADY part of the
// recruiter-facing anonymized card, so returning them to the candidate
// about themselves is not a new PII surface. Sensitive columns we
// deliberately keep OUT of this GET (no UI consumer + no need to widen
// the exposure surface): phone, work_authorized_us,
// requires_sponsorship.
// Extended for the wizard-edit flow so /apply?edit=1 can prefill every
// editable FormState field. The four additions below (phone,
// detailed_experience, work_authorized_us, requires_sponsorship) are
// candidate-self only — the bearer ownership gate above ensures only
// the candidate themselves can read these. They are deliberately not
// rendered by any recruiter-facing UI; src/hooks/useCandidates.ts
// currently does select('*') which transmits work_authorized_us /
// requires_sponsorship to the recruiter browser but no card displays
// them. Narrowing that hook is a tracked follow-up; out of scope here.
const CANDIDATE_GET_COLUMNS = [
  'id', 'name', 'display_name', 'email', 'phone',
  'label', 'location', 'experience',
  'education', 'highest_education_level',
  'primary_background', 'secondary_backgrounds', 'detailed_experience',
  // Phase 2 of the skills redesign: the new controlled-taxonomy
  // field. Returned so the wizard's edit-mode prefill can hydrate
  // form.areasOfExpertise from it (falling back to
  // detailed_experience as a one-time mirror for the 11 existing
  // candidates). Writes happen through /api/update-candidate-areas,
  // NOT through this PATCH — areas_of_expertise stays out of the
  // PATCH whitelist by design.
  'areas_of_expertise',
  'profile_description', 'open_to_opportunities',
  'work_preference', 'work_preferences',
  'target_salary', 'preferred_cities', 'preferred_cities_other',
  'target_roles', 'target_company_stages', 'industries', 'industries_other',
  'new_areas', 'linkedin_url', 'resume_full_url',
  'work_authorized_us', 'requires_sponsorship',
  'status',
].join(', ');

// Bearer auth helper extracted to api/_shared/verifyBearerEmail.js so
// other candidate-self endpoints (e.g. /api/update-candidate-skills)
// can use the same validated-against-auth-server check. Same contract.

export default async function handler(req, res) {
  console.log('[candidate-profile] env check:', {
    hasUrl: !!process.env.SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // ── GET — candidate-self read ────────────────────────────────────────
    if (req.method === 'GET') {
      const email = req.query.email;
      if (!email) return res.status(400).json({ error: 'email required' });
      const emailStr = String(email).toLowerCase().trim();

      // Step 0: verify bearer token, get the caller's real email.
      const auth = await verifyBearerEmail(req, supabase);
      if (auth.error) {
        console.warn('[candidate-profile] GET auth FAIL:', auth.error);
        return res.status(auth.status).json({ error: auth.error });
      }
      if (auth.email !== emailStr) {
        // Verified user is trying to read a different candidate's row.
        // 403 (not 404) so we don't leak whether the address exists.
        console.warn('[candidate-profile] GET ownership FAIL:', { verified: auth.email, requested: emailStr });
        return res.status(403).json({ error: 'Forbidden' });
      }

      console.log('[candidate-profile] GET ok, looking up:', emailStr);

      // Step 1: candidate row (any non-deleted status — pending/active/
      // rejected/inactive candidates can all view their own profile).
      const { data: candidate, error: candidateError } = await supabase
        .from('candidates')
        .select(CANDIDATE_GET_COLUMNS)
        .eq('email', emailStr)
        .neq('status', 'deleted')
        .maybeSingle();

      if (candidateError) {
        console.error('[candidate-profile] step 1 FAILED:', JSON.stringify({
          message: candidateError.message,
          code: candidateError.code,
          hint: candidateError.hint,
          details: candidateError.details,
        }));
        return res.status(500).json({ error: candidateError.message });
      }

      if (!candidate) return res.status(404).json({ error: 'No candidate found' });

      // Step 2: skills (joined via candidate_skills).
      const { data: skillsData, error: skillsError } = await supabase
        .from('candidate_skills')
        .select('skills(skill)')
        .eq('candidate_id', candidate.id);

      if (skillsError) {
        console.error('[candidate-profile] step 2 FAILED:', JSON.stringify({
          message: skillsError.message,
          code: skillsError.code,
          hint: skillsError.hint,
          details: skillsError.details,
        }));
        return res.status(500).json({ error: skillsError.message });
      }

      const skills = (skillsData || []).map(s => s.skills?.skill).filter(Boolean);

      // Step 3: candidate's resumes from the Phase A candidate_resumes
      // table. Returned here so the dashboard Resume tab doesn't need
      // a separate list endpoint. The same bearer + email-ownership
      // gate above protects this read. Order is default first, then
      // by creation. storage_path is included so the client can
      // derive a filename for display; the actual download URL is
      // minted via /api/get-candidate-resume-url (separate auth +
      // signed-URL gate).
      const { data: resumesData, error: resumesError } = await supabase
        .from('candidate_resumes')
        .select('id, label, storage_path, is_default, created_at, updated_at')
        .eq('candidate_id', candidate.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (resumesError) {
        // Non-fatal: if the resumes lookup fails, return the rest of
        // the profile so the dashboard still renders. Empty array
        // signals "no resumes on file" to the UI.
        console.warn('[candidate-profile] resumes lookup failed (non-fatal):', resumesError.message);
      }
      const resumes = resumesData || [];

      return res.status(200).json({ candidate: { ...candidate, skills, resumes } });
    }

    // ── PATCH — candidate-self update ────────────────────────────────────
    if (req.method === 'PATCH') {
      const { id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });

      // Step 0: verify bearer token.
      const auth = await verifyBearerEmail(req, supabase);
      if (auth.error) {
        console.warn('[candidate-profile] PATCH auth FAIL:', auth.error);
        return res.status(auth.status).json({ error: auth.error });
      }

      // Step 1: load the target row's email so we can match against the
      // verified caller. Looking it up server-side (instead of trusting a
      // client-supplied email) is the whole point — id alone is not
      // self-attesting.
      const { data: target, error: lookupErr } = await supabase
        .from('candidates')
        .select('id, email, status')
        .eq('id', id)
        .maybeSingle();

      if (lookupErr) {
        console.error('[candidate-profile] PATCH lookup FAILED:', JSON.stringify(lookupErr));
        return res.status(500).json({ error: lookupErr.message });
      }
      if (!target || target.status === 'deleted') {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      const ownerEmail = String(target.email || '').toLowerCase().trim();
      if (!ownerEmail || ownerEmail !== auth.email) {
        console.warn('[candidate-profile] PATCH ownership FAIL:', { verified: auth.email, owner: ownerEmail, id });
        return res.status(403).json({ error: 'Forbidden' });
      }

      console.log('[candidate-profile] PATCH ok, id:', id);

      // Server-side column whitelist. With ownership verified above, an
      // unwhitelisted update would let a candidate self-approve by
      // sending { status: 'active' } and bypassing admin review — that's
      // privilege escalation, not a minor leak. So we filter the payload
      // to a closed set of editable preference/profile columns and drop
      // everything else SILENTLY (no error — so future client additions
      // don't blow up legitimate edits while still being safely ignored
      // server-side until the whitelist is intentionally widened).
      //
      // Explicitly excluded by virtue of not being in this list:
      //   - status, approved_at, approved_by, rejection_reason (approval workflow)
      //   - id, email, display_name (identity / anonymity key — set at
      //     submit time only; changing display_name post-approval would
      //     decouple it from the recruiter-facing anonymized card)
      //   - sfc_* (admin-curated "SFC Take" content)
      //   - any new column added later
      // `skills` is included so the dashboard's Edit form save round-trip
      // behaves the same as it did before this hardening (preserving
      // today's behavior, per spec).
      // Wizard-edit additions: phone, primary_background,
      // secondary_backgrounds, detailed_experience, experience, label,
      // location, education, highest_education_level,
      // work_authorized_us, requires_sponsorship.
      //
      // `skills` was REMOVED from the whitelist — candidates.skills is
      // not a column. Skills live in candidate_skills (join table) and
      // any .update({skills: ...}) on candidates errors from PostgREST,
      // failing the entire PATCH. Until a dedicated
      // /api/update-candidate-skills endpoint owns the join writes,
      // skills are read-only in edit mode (the wizard surfaces a
      // "coming soon" note). Tracked follow-up; not this build.
      //
      // Still EXCLUDED by design: id, email, name, display_name (auth/
      // anonymity keys); status, approved_at, approved_by,
      // rejection_reason (admin approval workflow); sfc_* (admin-
      // curated). A candidate must never be able to write any of these.
      const ALLOWED_PATCH_COLUMNS = new Set([
        'phone',
        'primary_background',
        'secondary_backgrounds',
        'detailed_experience',
        'experience',
        'label',
        'location',
        'education',
        'highest_education_level',
        'profile_description',
        'work_preference',
        'work_preferences',
        'target_salary',
        'open_to_opportunities',
        'preferred_cities',
        'preferred_cities_other',
        'target_roles',
        'linkedin_url',
        'industries',
        'industries_other',
        'target_company_stages',
        'new_areas',
        'work_authorized_us',
        'requires_sponsorship',
      ]);
      const safeUpdates = {};
      const droppedKeys = [];
      for (const k of Object.keys(updates)) {
        if (!ALLOWED_PATCH_COLUMNS.has(k)) {
          droppedKeys.push(k);
          continue;
        }
        // `experience` is an integer column. Coerce + validate
        // server-side so a client sending "5" (string) or "5to10"
        // (years bucket) doesn't break the update. Reject obvious
        // garbage but don't fail the whole save — drop just this key.
        if (k === 'experience') {
          const n = Number(updates[k]);
          if (Number.isFinite(n) && n >= 0 && n <= 60 && Number.isInteger(n)) {
            safeUpdates[k] = n;
          } else {
            console.warn('[candidate-profile] PATCH: dropping non-integer experience value:', updates[k]);
            droppedKeys.push(k);
          }
          continue;
        }
        safeUpdates[k] = updates[k];
      }
      if (droppedKeys.length > 0) {
        console.warn('[candidate-profile] PATCH dropped non-whitelisted keys:', droppedKeys);
      }
      if (Object.keys(safeUpdates).length === 0) {
        // Nothing left to write — treat as a no-op success rather than
        // hitting the DB with an empty update.
        return res.status(200).json({ success: true, dropped: droppedKeys });
      }

      const { error: patchError } = await supabase.from('candidates').update(safeUpdates).eq('id', id);
      if (patchError) {
        console.error('[candidate-profile] PATCH FAILED:', JSON.stringify({
          message: patchError.message,
          code: patchError.code,
          hint: patchError.hint,
          details: patchError.details,
        }));
        return res.status(500).json({ error: patchError.message });
      }

      // ── Admin notify on successful edit (best-effort) ───────────────
      // Server-side so a client can't skip it; logged but never blocks
      // the save (mirrors the recruiter-signup pattern). Fires only on
      // candidate-self EDITs via this PATCH endpoint — the create flow
      // in /api/submit-candidate has its own "New Candidate Application"
      // admin email and is not touched here, so this won't double-notify.
      // No field-level diff in this pass (just identity + a Review CTA).
      let notifyEmailSent = false;
      let notifyEmailError = null;
      if (!process.env.RESEND_API_KEY) {
        notifyEmailError = 'RESEND_API_KEY missing';
        console.warn('[candidate-profile] PATCH notify skipped:', notifyEmailError);
      } else {
        try {
          // Pull display_name + id for the notification subject/body.
          // Use the verified candidate row (target) we loaded for
          // ownership, augmented with display_name; second fetch is
          // cheap and keeps the notify branch self-contained.
          const { data: notifyRow } = await supabase
            .from('candidates')
            .select('id, display_name, name, label')
            .eq('id', id)
            .maybeSingle();
          const displayName = (notifyRow?.display_name || notifyRow?.label || notifyRow?.name || 'A candidate').trim();
          const reviewUrl = `${APP_URL}/admin`;
          const html = `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#0F6E56">Candidate profile updated</h2>
            <p><strong>${displayName}</strong> updated their profile.</p>
            <div style="margin:24px 0"><a href="${reviewUrl}" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">Review in admin panel →</a></div>
            <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
            <p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>
          </div>`;
          const r = await resend.emails.send({
            from: FROM_ADDR,
            to: ADMIN_NOTIFY_EMAIL,
            subject: `Candidate profile updated: ${displayName}`,
            html,
          });
          if (r?.error) {
            notifyEmailError = r.error.message || String(r.error);
            console.error('[candidate-profile] PATCH notify Resend error:', notifyEmailError);
          } else {
            notifyEmailSent = true;
          }
        } catch (err) {
          notifyEmailError = err?.message || String(err);
          console.error('[candidate-profile] PATCH notify threw:', notifyEmailError);
        }
      }

      return res.status(200).json({
        success: true,
        notifyEmailSent,
        ...(notifyEmailError ? { notifyEmailError } : {}),
        ...(droppedKeys.length ? { dropped: droppedKeys } : {}),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[candidate-profile] handler FAILED:', JSON.stringify({
      message: err?.message,
      stack: err?.stack,
    }));
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
