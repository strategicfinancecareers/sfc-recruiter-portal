import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { generateResumeSignedUrl } from './_shared/signedUrl.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NOTIFY_EMAIL = 'zu@strategicfinancecareers.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      // Identity
      firstName, lastName, email, phone, linkedin,
      // Parsed profile
      currentRole, location, yearsExperience, education, educationLevel,
      bio, skills,
      // Industries (replaces the old `sectors` payload key — now stored
      // in candidates.industries instead of being dropped on the floor).
      // Backwards-compat: accept old `sectors` key from any unmigrated client.
      industries, industriesOther, sectors: legacySectors,
      // Background segmentation
      primaryBackground, secondaryBackgrounds, detailedExperience,
      // Phase 2 of the skills redesign: the new controlled-taxonomy
      // field. The wizard currently dual-writes — sending the same
      // array as both areasOfExpertise (new column) and
      // detailedExperience (legacy column). We accept both and
      // write to both columns until Phase 3 re-points the readers.
      areasOfExpertise,
      // NEW form-rework fields
      companyStages, newAreas,
      // Stages the candidate has WORKED at — paired with the
      // candidates.company_stage_experience column. Optional.
      companyStageExperience,
      // Availability / preferences (work_preferences is now a multi-select
      // array; legacy clients may still send work_preference as a string)
      jobSearchStatus, targetComp,
      workPreferences, workPreference: legacyWorkPreference,
      preferredCities, preferredCitiesOther, targetRoles,
      // Work authorization (NEW, two-question pair, store-only)
      workAuthorizedUs, requiresSponsorship,
      // SFC student / alumni (form-edits batch — Tab 6).
      // All three optional. is_sfc_alum boolean (or null when
      // unanswered); sfc_program / sfc_coach are text from a
      // closed wizard set (Base/Growth/Elite, Zu Daya / Soomin Song
      // / Dee Clarke). Empty strings from the client get normalized
      // to null before writing.
      isSfcAlum, sfcProgram, sfcCoach,
      // Resume
      resumeBase64, resumeFileName,
    } = req.body;

    // Normalize legacy → new shape so this endpoint serves both new and old
    // clients during the rollout window.
    const industriesArr: string[] =
      Array.isArray(industries) ? industries
      : Array.isArray(legacySectors) ? legacySectors
      : [];
    const workPrefsArr: string[] =
      Array.isArray(workPreferences) ? workPreferences
      : (typeof legacyWorkPreference === 'string' && legacyWorkPreference ? [legacyWorkPreference] : []);
    const companyStagesArr: string[] = Array.isArray(companyStages) ? companyStages : [];
    const companyStageExperienceArr: string[] =
      Array.isArray(companyStageExperience) ? companyStageExperience : [];
    const newAreasArr: string[] = Array.isArray(newAreas) ? newAreas : [];

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for duplicate email (case-insensitive)
    const { data: existing } = await supabase
      .from('candidates')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    // Any non-deleted existing row blocks a fresh insert (active, pending,
    // rejected, inactive). Only 'deleted' rows can be re-activated by a new
    // submission — that's the re-application path.
    if (existing && existing.status !== 'deleted') {
      return res.status(200).json({ success: true, candidateId: existing.id, alreadyExists: true });
    }

    const isReapplication = existing?.status === 'deleted';
    const existingId: string | null = isReapplication ? existing!.id : null;

    // Upload resume to Supabase Storage if provided.
    // Bucket 'resumes' is PRIVATE — we store only the storage path here,
    // not a URL. Consumers must generate a signed URL when they need
    // to read the file (see /api/get-resume-url — to be built).
    // The supabase client is initialized with the service-role key
    // above, so this upload bypasses bucket RLS.
    let resumePath: string | null = null;
    if (resumeBase64 && resumeFileName) {
      try {
        const buffer = Buffer.from(resumeBase64, 'base64');
        const safeFileName = `${Date.now()}_${(firstName + '_' + lastName).replace(/\s+/g, '_')}.pdf`;
        const objectPath = `candidates/${safeFileName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(objectPath, buffer, { contentType: 'application/pdf', upsert: false });
        if (!uploadError && uploadData) {
          // Store just the storage path, NOT a public URL — bucket is private now.
          resumePath = uploadData.path;
        } else {
          console.error('[submit-candidate] resume upload error:', JSON.stringify({
            message: (uploadError as any)?.message,
            statusCode: (uploadError as any)?.statusCode,
            error: (uploadError as any)?.error,
            name: (uploadError as any)?.name,
            details: (uploadError as any)?.details,
            hint: (uploadError as any)?.hint,
            attemptedPath: objectPath,
          }));
        }
      } catch (uploadErr: any) {
        console.error('[submit-candidate] resume upload threw:', JSON.stringify({
          message: uploadErr?.message,
          name: uploadErr?.name,
          stack: uploadErr?.stack,
        }));
      }
    }

    // Build display name and profile description — all fields have safe fallbacks
    const expNum = Number(yearsExperience) || 0;
    const expLabel = expNum >= 10 ? '10+' : expNum >= 5 ? '5+' : expNum >= 2 ? '2+' : '1+';
    const safeRole = (currentRole || primaryBackground || 'Finance Professional').trim();
    // Use the normalized industriesArr (was reading from raw `sectors`).
    const safeSector = industriesArr.length > 0 ? industriesArr[0] : 'Finance';
    const displayName = `${safeRole} — ${safeSector}`;

    const availabilityNote = [
      jobSearchStatus ? `Job search status: ${jobSearchStatus}.` : '',
      targetComp ? `Target comp: ${targetComp}.` : '',
      workPrefsArr.length > 0 ? `Work preference: ${workPrefsArr.join(', ')}.` : '',
      Array.isArray(preferredCities) && preferredCities.length > 0 ? `Preferred cities: ${preferredCities.join(', ')}.` : '',
    ].filter(Boolean).join(' ');

    const profileDescription = [bio, availabilityNote].filter(Boolean).join('\n\n');

    // ── Core insert payload (columns that definitely exist) ──────────────────
    // Two pre-existing bugs fixed here:
    //   1. linkedin_url was collected on /apply but never written. Now it is.
    //   2. industries (formerly `sectors`) was sent in the body and dropped
    //      on the floor. Now stored in candidates.industries[] (extended
    //      payload below) + the per-row override in industries_other.
    const corePayload = {
      name: `${firstName} ${lastName}`.trim() || 'Anonymous',
      display_name: displayName,
      email,
      phone: phone || null,
      linkedin_url: (typeof linkedin === 'string' && linkedin.trim()) ? linkedin.trim() : null,
      location: (location || 'United States').trim(),
      experience: expNum,
      education: (education || 'Not specified').trim(),
      highest_education_level: educationLevel || null,
      label: safeRole,
      profile_description: profileDescription || null,
      // Recruiter-side "is this person open?" filter signal. Mirrors
      // the edit-save mapping in CandidateApply.tsx:
      //   Actively Looking  → true   (strong open)
      //   Passively Looking → true   (still open, softer signal)
      //   Not Active        → false
      //   (missing/unknown) → true   (legacy default — preserves the
      //                               prior submit behavior where the
      //                               column was hardcoded true; only
      //                               an explicit "Not Active" flips
      //                               it false, so no existing flow
      //                               that didn't pick a value loses
      //                               visibility)
      open_to_opportunities: jobSearchStatus !== 'Not Active',
      // Storage path (not a URL) — bucket 'resumes' is private.
      // Consumers must generate a signed URL via /api/get-resume-url before use.
      resume_full_url: resumePath,
      resume_redacted_url: null,
    };

    // ── Extended payload (columns that require migrations) ───────────────────
    // status: 'pending' is set explicitly so re-applications (which UPDATE a
    // 'deleted' row, bypassing the column default) are also routed back into
    // the admin review queue. For fresh INSERTs this matches the DB default
    // set by the candidate-approval migration.
    //
    // Form-rework additions:
    //   - industries[] + industries_other  (was unstored as `sectors`)
    //   - target_company_stages[]          (NEW)
    //   - new_areas[]                       (NEW)
    //   - target_salary                     (now lives on Future Job Preferences)
    //   - work_preferences[]                (NEW — multi-select)
    //   - work_preference                   (mirror of work_preferences[0], DEPRECATED)
    //   - preferred_cities + preferred_cities_other
    //   - work_authorized_us, requires_sponsorship (NEW — two-question pair)
    const extendedPayload = {
      ...corePayload,
      status: 'pending',
      primary_background: primaryBackground || null,
      secondary_backgrounds: Array.isArray(secondaryBackgrounds) ? secondaryBackgrounds : [],
      detailed_experience: Array.isArray(detailedExperience) ? detailedExperience : [],
      // Phase 2 dual-write: write the same array to the new
      // controlled-taxonomy column. Falls back to detailedExperience
      // if a legacy client hasn't been updated to send areasOfExpertise
      // explicitly — keeps backward compat in flight while the wizard
      // ships.
      areas_of_expertise: Array.isArray(areasOfExpertise) && areasOfExpertise.length > 0
        ? areasOfExpertise
        : (Array.isArray(detailedExperience) ? detailedExperience : []),
      industries: industriesArr,
      industries_other: (typeof industriesOther === 'string' && industriesOther.trim()) ? industriesOther.trim() : null,
      target_company_stages: companyStagesArr,
      company_stage_experience: companyStageExperienceArr,
      new_areas: newAreasArr,
      target_salary: (typeof targetComp === 'string' && targetComp.trim()) ? targetComp.trim() : null,
      work_preferences: workPrefsArr,
      // Deprecated mirror — keep populated for one release so admin code
      // that still reads `work_preference` (string) doesn't break.
      work_preference: workPrefsArr[0] || null,
      preferred_cities: Array.isArray(preferredCities) ? preferredCities : [],
      preferred_cities_other: (typeof preferredCitiesOther === 'string' && preferredCitiesOther.trim()) ? preferredCitiesOther.trim() : null,
      target_roles: Array.isArray(targetRoles) ? targetRoles : [],
      work_authorized_us: typeof workAuthorizedUs === 'boolean' ? workAuthorizedUs : null,
      requires_sponsorship: typeof requiresSponsorship === 'boolean' ? requiresSponsorship : null,
      // Form-edits batch — Tab 6: SFC student / alumni.
      is_sfc_alum: typeof isSfcAlum === 'boolean' ? isSfcAlum : null,
      sfc_program: (typeof sfcProgram === 'string' && sfcProgram.trim()) ? sfcProgram.trim() : null,
      sfc_coach:   (typeof sfcCoach   === 'string' && sfcCoach.trim())   ? sfcCoach.trim()   : null,
    };

    // ── Save candidate: update (re-application) or insert (new) ─────────────
    let candidateId: string | null = null;

    if (isReapplication && existingId) {
      // Re-activating a deleted profile — update the existing row
      console.log('[submit-candidate] re-application for deleted account, updating id:', existingId);
      const { error: updateErr } = await supabase
        .from('candidates')
        .update(extendedPayload as any)
        .eq('id', existingId);

      if (updateErr) {
        console.warn('[submit-candidate] full update failed, trying core fields:', updateErr.message);
        await supabase.from('candidates').update(corePayload).eq('id', existingId);
      }
      candidateId = existingId;
    } else {
      // ── Attempt 1: full insert with all columns ─────────────────────────────
      const { data: candidate1, error: insertError1 } = await supabase
        .from('candidates')
        .insert(extendedPayload as any)
        .select('id')
        .single();

      if (insertError1) {
        console.error('[submit-candidate] full insert failed:', JSON.stringify(insertError1));

        // ── Unique-violation backstop ──────────────────────────────────────────
        // candidates_email_lower_unique enforces one row per lower(email).
        // The pre-check SELECT above catches the common case, but a concurrent
        // submit can pass that SELECT and collide here. A duplicate must never
        // become a 500 — return the SAME friendly shape the pre-check returns
        // so the client shows the "already submitted, please sign in" message.
        // (23505 = unique_violation.)
        if ((insertError1 as any)?.code === '23505') {
          console.log('[submit-candidate] duplicate email (23505) on full insert — returning alreadyExists');
          return res.status(200).json({ success: true, alreadyExists: true });
        }

        // ── Attempt 2: core fields only (fallback if migrations not run) ───────
        const { data: candidate2, error: insertError2 } = await supabase
          .from('candidates')
          .insert(corePayload)
          .select('id')
          .single();

        if (insertError2) {
          console.error('[submit-candidate] core insert also failed:', JSON.stringify(insertError2));
          // Same unique-violation backstop on the fallback path — if the full
          // insert failed for a column reason but the email already exists,
          // the core insert collides on candidates_email_lower_unique too.
          if ((insertError2 as any)?.code === '23505') {
            console.log('[submit-candidate] duplicate email (23505) on core insert — returning alreadyExists');
            return res.status(200).json({ success: true, alreadyExists: true });
          }
          return res.status(500).json({
            error: 'Failed to save application',
            detail: insertError2.message,
            hint: 'Check required fields: name, display_name, email, location, experience, education, label',
          });
        }

        candidateId = candidate2.id;
        console.log('[submit-candidate] saved with core fields only (migrations pending)');
      } else {
        candidateId = candidate1.id;
      }
    }

    // ── Close the multi-resume create-flow gap (Phase B) ─────────────────
    // Phase A's candidate_resumes table is the new source of truth; the
    // candidates.resume_full_url column above is the deprecated mirror
    // we'll drop in Phase C. Until then we DUAL-WRITE on submission so
    // every new candidate has a candidate_resumes row alongside the
    // mirror, matching the model the dashboard + intro-pick flows
    // expect. ON CONFLICT keeps re-applications (which UPDATE the
    // candidates row) idempotent against the UNIQUE(candidate_id,
    // label) constraint — re-applying with the same default label
    // doesn't error, and a re-application that updates resumePath
    // updates the row's storage_path to match.
    // Wrapped in its own try/catch so a thrown exception (network
    // blip, supabase-js client failure, etc.) on the candidate_resumes
    // upsert can NEVER fail the submission. By this point the
    // candidates row and the resume_full_url + storage upload are
    // already committed, and the deprecated mirror keeps the
    // fallback chain working — so a missing candidate_resumes row
    // is at worst a transient gap until the candidate next opens
    // the dashboard and uploads/edits. The outer handler's catch
    // returns 500 to the client; we must not let a mirror-write
    // failure trigger that.
    if (candidateId && resumePath) {
      try {
        const { error: resumeRowErr } = await supabase
          .from('candidate_resumes')
          .upsert(
            {
              candidate_id: candidateId,
              label: 'Resume',
              storage_path: resumePath,
              is_default: true,
            },
            { onConflict: 'candidate_id,label' }
          );
        if (resumeRowErr) {
          console.warn('[submit-candidate] candidate_resumes upsert returned error (mirror still works):', resumeRowErr.message);
        } else {
          console.log('[submit-candidate] candidate_resumes row written (default=true)');
        }
      } catch (resumeRowThrow: any) {
        console.warn('[submit-candidate] candidate_resumes upsert threw (mirror still works):', resumeRowThrow?.message || String(resumeRowThrow));
      }
    }

    // Auth account is created during signup — just use the plain dashboard URL
    const dashboardLink = 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard';

    // ── Welcome email to candidate ────────────────────────────────────────────
    const welcomeHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
      + '<h2 style="color:#0F6E56">Profile received</h2>'
      + '<p>Hi ' + firstName + ',</p>'
      + '<p>Thanks for submitting your profile to SFC Talent. Your profile is now <strong>under review</strong> by our team. We manually vet every candidate before adding you to our platform. Our promise is to both professionals like yourself and recruiters.</p>'
      + '<p>What happens next:</p>'
      + '<ul>'
      + '<li>Our team reviews your profile (usually within 1 to 2 business days)</li>'
      + '<li>We\'ll email you the moment your profile is approved</li>'
      + '<li>Once approved, recruiters can browse your anonymous profile and request introductions</li>'
      + '<li>If you\'re an early adopter, you may not see recruiter requests for a little while. Thank you for being an early adopter!</li>'
      + '<li>You\'ll have <strong>48 hours to respond</strong> to each intro request</li>'
      + '</ul>'
      + '<div style="background:#f0faf6;border-left:4px solid #0F6E56;padding:16px;border-radius:4px;margin:24px 0">'
      + '<p style="margin:0;font-weight:600">Manage your profile</p>'
      + '<p style="margin:8px 0 12px;color:#666;font-size:14px">Update your bio, skills, and availability anytime from your candidate dashboard.</p>'
      + '<a href="' + dashboardLink + '" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px">Open My Dashboard →</a>'
      + '<p style="margin:12px 0 0;color:#999;font-size:12px">Sign in with the email and password you created during signup.</p>'
      + '</div>'
      + '<p style="color:#666;font-size:14px">Your identity is always protected. We never share your name, contact details, or employer without your explicit consent.</p>'
      + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
      + '<p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>'
      + '</div>';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'SFC Talent <noreply@strategicfinancecareers.com>',
        to: [email],
        subject: 'Welcome to SFC Talent, your profile is under review',
        html: welcomeHtml,
      }),
    }).catch(err => console.warn('[submit-candidate] welcome email failed:', err.message));

    // ── Insert skills ─────────────────────────────────────────────────────────
    if (Array.isArray(skills) && skills.length > 0) {
      for (const skillName of skills) {
        if (!skillName?.trim()) continue;
        const { data: skillRow } = await supabase
          .from('skills')
          .upsert({ skill: skillName.trim() }, { onConflict: 'skill' })
          .select('id')
          .single();
        if (skillRow?.id) {
          await supabase.from('candidate_skills').insert({
            candidate_id: candidateId,
            skill_id: skillRow.id,
          });
        }
      }
    }

    // ── Send notification email ───────────────────────────────────────────────
    // Generate a 7-day signed URL so the admin can download the resume
    // directly from the notification email. Bucket is private; signed URL
    // is the only way to grant access. Falls back to a path-only block if
    // generation fails — never blocks the email send.
    let adminResumeUrl: string | null = null;
    if (resumePath && candidateId) {
      const result = await generateResumeSignedUrl(supabase, candidateId, 7 * 24 * 60 * 60);
      if (result.status === 200 && result.url) {
        adminResumeUrl = result.url;
      } else {
        console.warn('[submit-candidate] admin signed URL fallback:', result.status, result.error);
      }
    }

    // Use normalized industriesArr / workPrefsArr (legacy keys folded above).
    const sectorList = industriesArr.length > 0
      ? (industriesArr.join(', ') + (industriesOther ? ` (Other: ${industriesOther})` : ''))
      : 'Not specified';
    // Phase 3 reader: prefer the new controlled-taxonomy field, fall
    // back to detailedExperience for any legacy client that hasn't
    // sent areasOfExpertise yet. The dual-write logic above is
    // untouched — only this email-body reader changed.
    const areasForEmailArr: string[] = (Array.isArray(areasOfExpertise) && areasOfExpertise.length > 0)
      ? areasOfExpertise
      : (Array.isArray(detailedExperience) ? detailedExperience : []);
    const areasForEmailStr = areasForEmailArr.length > 0 ? areasForEmailArr.join(', ') : 'Not specified';
    const secondaryList = Array.isArray(secondaryBackgrounds) && secondaryBackgrounds.length > 0 ? secondaryBackgrounds.join(', ') : '—';
    const roleList = Array.isArray(targetRoles) && targetRoles.length > 0 ? targetRoles.join(', ') : 'Not specified';
    const citiesList = Array.isArray(preferredCities) && preferredCities.length > 0
      ? (preferredCities.join(', ') + (preferredCitiesOther ? ` (Other: ${preferredCitiesOther})` : ''))
      : '—';
    const workPrefList = workPrefsArr.length > 0 ? workPrefsArr.join(', ') : '—';
    const companyStageList = companyStagesArr.length > 0 ? companyStagesArr.join(', ') : '—';
    const newAreasList = newAreasArr.length > 0 ? newAreasArr.join(', ') : '—';
    const fmtBool = (v: unknown) => v === true ? 'Yes' : v === false ? 'No' : '—';

    const emailHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
      + '<h2 style="color:#0F6E56;margin-bottom:4px">New Candidate Application</h2>'
      + '<p style="color:#666;margin-top:0">A new candidate has submitted their profile for review.</p>'
      + '<table style="width:100%;border-collapse:collapse;margin:20px 0">'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;width:38%">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">' + firstName + ' ' + lastName + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + email + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (phone || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">LinkedIn</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (linkedin || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Role</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (currentRole || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Location</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (location || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Experience</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + expNum + ' years</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Education</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (education || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Primary Background</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (primaryBackground || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Secondary</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + secondaryList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Areas of Expertise</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + areasForEmailStr + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Job Status</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (jobSearchStatus || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Target Comp</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (targetComp || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Work Preference</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + workPrefList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Preferred Cities</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + citiesList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Industries</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + sectorList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Company Stage</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + companyStageList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">New Areas</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + newAreasList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Target Roles</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + roleList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">US Work Authorized</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + fmtBool(workAuthorizedUs) + '</td></tr>'
      + '<tr><td style="padding:8px 0;color:#888">Requires Sponsorship</td><td style="padding:8px 0">' + fmtBool(requiresSponsorship) + '</td></tr>'
      + '</table>'
      + (bio ? '<div style="margin:16px 0;padding:16px;background:#f9f9f9;border-radius:8px"><p style="color:#666;font-size:12px;margin:0 0 8px">Bio</p><p style="margin:0;color:#333">' + bio + '</p></div>' : '')
      + (adminResumeUrl
          ? '<div style="margin:20px 0"><a href="' + adminResumeUrl + '" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">📎 Download Resume</a><p style="margin:8px 0 0;color:#999;font-size:12px">Link valid for 7 days.</p></div>'
          : (resumePath
              ? '<p style="color:#888;font-size:13px">Resume uploaded — view in SFC Admin portal.</p>'
              : '<p style="color:#888;font-size:13px">No resume uploaded.</p>'))
      + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
      + '<p style="color:#aaa;font-size:12px">Review this application in the SFC Admin portal.</p>'
      + '</div>';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'SFC Talent <noreply@strategicfinancecareers.com>',
        to: [NOTIFY_EMAIL],
        subject: `New Candidate Application: ${firstName} ${lastName} — ${safeRole}`,
        html: emailHtml,
      }),
    });

    // ── Batch 2 — auto-draft SFC Take in the background ─────────────────────
    // Non-blocking: AI failure must NOT fail the submission. We don't await.
    // The toggle lives in app_settings.sfc_take_auto_draft_enabled so admin
    // can flip it off without a deploy.
    if (candidateId) {
      try {
        const { data: toggle } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'sfc_take_auto_draft_enabled')
          .maybeSingle();
        const enabled = (toggle as any)?.value === true || (toggle as any)?.value === 'true';
        if (enabled) {
          const draftBase = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'https://sfc-recruiter-portal.vercel.app';
          // Fire-and-forget. Logs but never rethrows.
          void fetch(`${draftBase}/api/generate-sfc-take`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-call': process.env.INTERNAL_API_SECRET || '',
            },
            body: JSON.stringify({ candidateId }),
          }).catch(err => {
            console.error('[submit-candidate] auto-draft kickoff failed:', err?.message || err);
          });
          console.log('[submit-candidate] auto-draft kickoff fired for', candidateId);
        }
      } catch (autoErr: any) {
        console.warn('[submit-candidate] auto-draft toggle check failed:', autoErr?.message || autoErr);
      }
    }

    return res.status(200).json({ success: true, candidateId });
  } catch (error: any) {
    console.error('[submit-candidate] unhandled error:', error.message, JSON.stringify(error));
    return res.status(500).json({ error: error.message });
  }
}
