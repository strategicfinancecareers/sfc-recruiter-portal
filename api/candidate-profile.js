import { createClient } from '@supabase/supabase-js';

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
const CANDIDATE_GET_COLUMNS = [
  'id', 'name', 'display_name', 'email',
  'label', 'location', 'experience',
  'profile_description', 'open_to_opportunities',
  'work_preference', 'work_preferences',
  'target_salary', 'preferred_cities', 'target_roles', 'industries',
  'linkedin_url', 'resume_full_url',
  'status',
].join(', ');

// ─── Auth helper ─────────────────────────────────────────────────────────────
// Validates the Authorization header against the auth server and returns
// the verified user's lowercased email. Returns { error, status } on
// failure (caller forwards as response).
async function verifyBearerEmail(req, supabase) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) {
    return { error: 'Missing Authorization bearer token', status: 401 };
  }
  const token = match[1].trim();
  if (!token) return { error: 'Missing Authorization bearer token', status: 401 };

  // supabase.auth.getUser(jwt) hits the auth server to validate
  // signature + expiry — do not trust an un-validated JWT.
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.email) {
    return { error: 'Invalid or expired session', status: 401 };
  }
  return { email: data.user.email.toLowerCase().trim() };
}

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
      return res.status(200).json({ candidate: { ...candidate, skills } });
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
      const ALLOWED_PATCH_COLUMNS = new Set([
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
        'skills',
      ]);
      const safeUpdates = {};
      const droppedKeys = [];
      for (const k of Object.keys(updates)) {
        if (ALLOWED_PATCH_COLUMNS.has(k)) safeUpdates[k] = updates[k];
        else droppedKeys.push(k);
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
      return res.status(200).json({ success: true });
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
