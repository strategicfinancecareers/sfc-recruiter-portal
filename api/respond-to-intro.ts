import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
// @ts-ignore — ESM JS helper, no .d.ts file
import { generateBestResumeSignedUrlForIntro } from './_shared/signedUrl.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Phase B chooser page. Rendered when the candidate clicks YES on the
// email link AND has more than one resume on file. Each option links
// back to GET /api/respond-to-intro?introId=X&response=yes&resumeId=Y
// so the second click pins selected_resume_id and finalizes the
// accept. Plain HTML so it renders inline from the email's link
// without depending on the SPA. HTML-escaped to defend against any
// hostile label content (labels are candidate-typed, so this is
// defense-in-depth rather than expected exploitation).
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function renderResumePicker({ introId, resumes }: {
  introId: string;
  resumes: Array<{ id: string; label: string; is_default: boolean }>;
}): string {
  const cards = resumes.map(r => `
    <a href="/api/respond-to-intro?introId=${encodeURIComponent(introId)}&response=yes&resumeId=${encodeURIComponent(r.id)}"
       style="display:block; padding:16px 18px; margin-bottom:10px; background:white; border:1px solid #e5e7eb; border-radius:10px; text-decoration:none; color:#111; transition:border-color .15s, box-shadow .15s;"
       onmouseover="this.style.borderColor='#008037'; this.style.boxShadow='0 1px 4px rgba(0,128,55,.15)';"
       onmouseout="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div>
          <div style="font-weight:600; font-size:15px;">${escapeHtml(r.label)}</div>
          ${r.is_default ? '<div style="font-size:11px; color:#008037; margin-top:2px; text-transform:uppercase; letter-spacing:.08em;">Default</div>' : ''}
        </div>
        <div style="color:#9ca3af; font-size:13px;">Use this →</div>
      </div>
    </a>
  `).join('');
  return `
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="font-family:sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#f9f9f9; padding:24px;">
        <div style="max-width:480px; width:100%; background:white; border-radius:12px; padding:32px; box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <h2 style="margin:0 0 6px; color:#111;">Choose a resume to send</h2>
          <p style="margin:0 0 20px; color:#6b7280; font-size:14px;">The recruiter will receive the resume you pick along with your contact details. You can change which resume is your default any time from your dashboard.</p>
          ${cards}
        </div>
      </body>
    </html>
  `;
}

// NOTE: This file previously hardcoded a personal Gmail address as a
// permanent CC on every recruiter-facing intro response email
// (approved + rejected). That meant a real human inbox was receiving
// every candidate's name, email, phone, and a 7-day signed resume
// download URL on every accept. Removed unconditionally — there is no
// "non-prod" version of this address to gate behind an env var, it was
// never appropriate to send PII to. If you ever want a test sink in a
// preview environment, add it via process.env and gate on
// process.env.VERCEL_ENV !== 'production'; do not reintroduce a
// hardcoded address here.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { introId, response, resumeId } = req.query;

  console.log('[respond-to-intro] introId:', introId, 'response:', response, 'resumeId:', resumeId || '(none)');

  if (!introId || !response) {
    return res.status(400).send('Invalid request');
  }

  try {
    // Get intro request
    const { data: intro, error: introErr } = await supabase
      .from('introduction_requests')
      .select('*')
      .eq('id', introId)
      .single();

    console.log('[respond-to-intro] intro:', JSON.stringify(intro), 'introErr:', JSON.stringify(introErr));

    if (!intro) return res.status(404).send('Not found');

    const accepted = response === 'yes';

    // ── Idempotency guard ───────────────────────────────────────────────
    // Both response surfaces (the email link and the dashboard buttons)
    // hit this endpoint, and email links especially get clicked more than
    // once. Only a 'pending' intro may be finalized: a repeat click must
    // NOT re-flip the status and must NOT re-send the recruiter email
    // (tester-reported bug: multiple accepts sent the recruiter the
    // contact-details email once per click). Render a friendly
    // already-responded page instead. The multi-resume chooser flow is
    // unaffected: its first click renders the picker WITHOUT writing, so
    // status is still 'pending' when the second (finalizing) click lands.
    if (intro.status !== 'pending') {
      const wasAccepted = intro.status === 'approved';
      console.log('[respond-to-intro] already responded (status:', intro.status, ') — skipping update + email for intro', introId);
      return res.status(200).send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9f9f9;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 400px;">
              <div style="font-size: 48px; margin-bottom: 16px;">${wasAccepted ? '✅' : '👋'}</div>
              <h2 style="color: #333; margin: 0 0 8px;">You've already responded</h2>
              <p style="color: #666;">${wasAccepted
                ? 'You accepted this introduction and the recruiter has been notified with your contact details. No further action is needed.'
                : "You passed on this introduction and the recruiter has been notified. If you've changed your mind, reply to the introduction email and we'll help out."}</p>
            </div>
          </body>
        </html>
      `);
    }

    // ── Multi-resume picker gate (Phase B) ──────────────────────────────
    // When the candidate accepts and has more than one resume on file, we
    // pause and render a chooser page instead of finalizing. The chooser
    // submits back to this same endpoint with ?resumeId=<chosen> so the
    // selected_resume_id gets pinned to the intro before the email goes
    // out and the recruiter's signedUrl fallback chain picks the right
    // file. If the candidate has 1 resume (the common case), we
    // auto-pick it silently — zero new friction. If they have 0 we
    // fall through to the existing flow with selected_resume_id NULL
    // and the helper falls back to the deprecated mirror column. The
    // 'no' path bypasses this entirely.
    let resolvedResumeId: string | null = null;
    if (accepted) {
      if (typeof resumeId === 'string' && resumeId.trim()) {
        resolvedResumeId = resumeId.trim();
      } else {
        const { data: resumesList, error: resumesErr } = await supabase
          .from('candidate_resumes')
          .select('id, label, is_default, created_at')
          .eq('candidate_id', (intro as any).candidate_id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true });
        if (resumesErr) {
          console.warn('[respond-to-intro] resume count lookup failed (proceeding with no pick):', resumesErr.message);
        } else if ((resumesList?.length || 0) > 1) {
          // Render the chooser page and stop. No DB writes yet, so a
          // candidate who closes the tab without choosing leaves the
          // intro in 'pending' — they can click YES again later.
          return res.status(200).send(renderResumePicker({
            introId: String(introId),
            resumes: resumesList as Array<{ id: string; label: string; is_default: boolean }>,
          }));
        } else if ((resumesList?.length || 0) === 1) {
          resolvedResumeId = (resumesList as any)[0].id;
        }
        // 0 resumes → resolvedResumeId stays null; fallback chain reaches the deprecated mirror.
      }
    }

    // Update status + responded_at + selected_resume_id (when accepted).
    // responded_at is set on every flip (status only flips once in practice,
    // so this is effectively first-write-wins). selected_resume_id is only
    // set on accept paths and is left NULL on rejects — the 'pass' email
    // doesn't reveal anything about the candidate's resume set anyway.
    const updatePayload: Record<string, unknown> = {
      status: accepted ? 'approved' : 'rejected',
      responded_at: new Date().toISOString(),
    };
    if (accepted && resolvedResumeId) updatePayload.selected_resume_id = resolvedResumeId;
    // Conditional on status='pending' so two near-simultaneous clicks can't
    // both finalize: the loser of the race matches zero rows and we bail
    // without sending a second email.
    const { data: updatedRows, error: updateErr } = await supabase
      .from('introduction_requests')
      .update(updatePayload)
      .eq('id', introId)
      .eq('status', 'pending')
      .select('id');
    console.log('[respond-to-intro] status update error:', JSON.stringify(updateErr), '| rows:', updatedRows?.length ?? 0, '| selected_resume_id:', resolvedResumeId);
    if (!updateErr && (updatedRows?.length ?? 0) === 0) {
      console.log('[respond-to-intro] lost finalize race (intro no longer pending) — skipping email for', introId);
      return res.status(200).send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9f9f9;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 400px;">
              <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
              <h2 style="color: #333; margin: 0 0 8px;">Response already recorded</h2>
              <p style="color: #666;">Your response to this introduction was already received. No further action is needed.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Fetch candidate, job, and recruiter user in parallel
    const [{ data: candidate }, { data: job }, { data: recruiterUser }] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', intro.candidate_id).single(),
      supabase.from('jobs').select('*').eq('id', intro.job_id).single(),
      intro.requester_id
        ? supabase.from('users').select('email, first_name, last_name').eq('id', intro.requester_id).single()
        : Promise.resolve({ data: null }),
    ]);

    console.log('[respond-to-intro] recruiterUser:', JSON.stringify(recruiterUser));
    console.log('[respond-to-intro] job:', JSON.stringify({ id: job?.id, title: job?.title, company: job?.company, user_id: job?.user_id }));

    // Recipient: the recruiter who requested the intro. If we can't
    // resolve their email (orphan intro / missing users row), we now
    // SKIP the send and log — previously this fell back to the test CC
    // alone, which meant the real recruiter never heard about the
    // candidate's response and the PII landed in a personal inbox.
    const recruiterEmail: string | undefined = (recruiterUser as any)?.email || undefined;
    if (!recruiterEmail) {
      console.warn('[respond-to-intro] no recruiter email on file — skipping notification send for intro', introId);
    }
    const toList: string[] = recruiterEmail ? [recruiterEmail] : [];
    console.log('[respond-to-intro] sending email to:', JSON.stringify(toList));

    console.log('[respond-to-intro] candidate fields:', JSON.stringify({ name: candidate?.name, display_name: candidate?.display_name, email: candidate?.email, phone: candidate?.phone, has_resume: !!candidate?.resume_full_url }));

    // candidateName is used in the ACCEPTED-branch email, where reveal is
    // explicit and intentional — name on acceptance is the whole point.
    // The REJECTED-branch email below uses anonName instead so we never
    // leak identity on a no.
    const candidateName = candidate?.name || candidate?.display_name || 'The candidate';
    const anonName = candidate?.display_name || 'A candidate';
    const jobTitle = job?.title;
    const company = job?.company;

    if (accepted) {
      // Generate a 7-day signed URL for the recruiter to download the
      // resume. Multi-resume aware: prefers
      // introduction_requests.selected_resume_id (set when the
      // candidate picks at acceptance — Phase B will add the UI for
      // this; through Phase A it's always NULL), falls back to the
      // candidate's default candidate_resumes row, and finally to
      // the deprecated candidates.resume_full_url. If all three
      // paths fail (no resume on file at all), we degrade gracefully
      // — don't fail the acceptance over an email cosmetic.
      let resumeDownloadUrl: string | null = null;
      if (candidate?.id) {
        // resolvedResumeId is what we just pinned to the intro row
        // (or null if the candidate has no resumes). Use it directly
        // — same source of truth the recruiter modal will use post-
        // accept via the row's selected_resume_id.
        const result = await generateBestResumeSignedUrlForIntro({
          supabase,
          candidateId: candidate.id,
          selectedResumeId: resolvedResumeId,
          expiresIn: 7 * 24 * 60 * 60,
        });
        if (result.status === 200 && result.url) {
          resumeDownloadUrl = result.url;
        } else {
          console.warn('[respond-to-intro] no signed URL via fallback chain:', result.status, result.error);
        }
      }

      const resumeBlock = resumeDownloadUrl
        ? `<div style="margin:16px 0"><a href="${resumeDownloadUrl}" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">📎 Download Resume</a><p style="margin:8px 0 0;color:#999;font-size:12px">Link valid for 7 days.</p></div>`
        : (candidate?.resume_full_url
            ? '<p style="color:#888;font-size:13px">Resume download will be available in the SFC portal.</p>'
            : '');

      const yesHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
        + '<img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom:24px" />'
        + '<h2 style="color:#0F6E56">Great news — they\'re interested!</h2>'
        + `<p><strong>${candidateName}</strong> has accepted your introduction request for the <strong>${jobTitle}</strong> role at <strong>${company}</strong>.</p>`
        + '<div style="background:#f0faf6;border-left:4px solid #0F6E56;padding:16px;border-radius:4px;margin:24px 0">'
        + '<p style="margin:0 0 10px"><strong>Candidate Details:</strong></p>'
        + `<p style="margin:0 0 6px">👤 <strong>${candidateName}</strong></p>`
        + `<p style="margin:0 0 6px">📧 <a href="mailto:${candidate?.email}?cc=talent@strategicfinancecareers.com" style="color:#0F6E56">${candidate?.email}</a></p>`
        + (candidate?.phone ? `<p style="margin:0">📱 <a href="tel:${candidate?.phone}" style="color:#0F6E56">${candidate?.phone}</a></p>` : '')
        + '</div>'
        + `<div style="margin:16px 0"><a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(candidate?.email || '')}&cc=${encodeURIComponent('talent@strategicfinancecareers.com')}&su=${encodeURIComponent('Introduction via SFC Talent' + (jobTitle ? ' - ' + jobTitle : ''))}" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">✉️ Email ${candidateName}</a></div>`
        + '<p style="color:#666;font-size:13px">The button opens Gmail with <strong>talent@strategicfinancecareers.com</strong> pre-filled as cc. Per your recruiter terms, please keep that address cc\'d on all emails with this candidate.</p>'
        + resumeBlock
        + '<p style="color:#666;font-size:14px">We recommend reaching out within 24 hours while their interest is fresh.</p>'
        + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />'
        + '<p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>'
        + '</div>';

      console.log('[respond-to-intro] sending YES email, signed URL included:', !!resumeDownloadUrl);
      if (toList.length === 0) {
        console.warn('[respond-to-intro] YES — no recipients resolved, skipping resend.emails.send');
      } else {
        const { data: emailData, error: emailErr } = await resend.emails.send({
          from: 'SFC Talent <noreply@strategicfinancecareers.com>',
          to: toList,
          subject: `✅ ${candidateName} is interested in your ${jobTitle} role`,
          html: yesHtml,
        });
        console.log('[respond-to-intro] YES email result:', JSON.stringify({ emailData, emailErr }));
      }
    } else {
      console.log('[respond-to-intro] sending NO email');
      if (toList.length === 0) {
        console.warn('[respond-to-intro] NO — no recipients resolved, skipping resend.emails.send');
      } else {
      const { data: noEmailData, error: noEmailErr } = await resend.emails.send({
        from: 'SFC Talent <noreply@strategicfinancecareers.com>',
        to: toList,
        // Use anonName (display_name) — anonymity guarantee: identity is
        // revealed ONLY on acceptance. Pass = no reveal.
        subject: `${anonName} passed on the ${jobTitle} role`,
        html: '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
          + '<img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom:24px" />'
          + '<h2 style="color:#333">Update on your introduction request</h2>'
          + `<p><strong>${anonName}</strong> has passed on the <strong>${jobTitle}</strong> opportunity at this time.</p>`
          + `<p>Don't worry — there are more great candidates available. <a href="https://sfc-recruiter-portal.vercel.app/browse" style="color:#0F6E56">Browse candidates</a> to find your next match.</p>`
          + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />'
          + '<p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>'
          + '</div>',
      });
      console.log('[respond-to-intro] NO email result:', JSON.stringify({ noEmailData, noEmailErr }));
      }
    }

    // Return a clean HTML response page
    return res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9f9f9;">
          <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 16px;">${accepted ? '✅' : '👋'}</div>
            <h2 style="color: #333; margin: 0 0 8px;">${accepted ? "You're connected!" : 'No problem!'}</h2>
            <p style="color: #666;">${accepted ? 'The recruiter has been notified with your contact details. Expect to hear from them soon.' : "We've let the recruiter know. We'll be in touch if other opportunities come up."}</p>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Something went wrong');
  }
}
