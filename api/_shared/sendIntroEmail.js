import { buildIntroEmail } from './introEmail.js';

// Sends the "a recruiter wants an introduction" email to the candidate
// for one introduction_requests row. Shared by:
//   - api/submit-intro.ts (in-process, right after the insert — this used
//     to be an HTTP hop to /api/send-intro-email gated on
//     INTERNAL_API_SECRET, which was never set in Vercel, so candidates
//     silently received nothing)
//   - api/send-intro-email.ts (admin/manual trigger endpoint)
//
// Returns { ok: true, emailResult } or { ok: false, status, error }.
// Never throws — callers treat email failure as non-fatal (the intro row
// is the source of truth) but must log the result.

export async function sendIntroEmailForIntro({ supabase, resend, introId }) {
  try {
    const { data: intro, error: introError } = await supabase
      .from('introduction_requests')
      .select('*')
      .eq('id', introId)
      .single();
    if (introError || !intro) {
      return { ok: false, status: introError ? 500 : 404, error: introError?.message || 'intro not found' };
    }

    // Candidate and job fetched separately to avoid FK ambiguity.
    const [{ data: candidate, error: candError }, { data: job, error: jobError }] = await Promise.all([
      supabase.from('candidates').select('*').eq('id', intro.candidate_id).single(),
      supabase.from('jobs').select('*').eq('id', intro.job_id).single(),
    ]);
    if (candError) console.error('[sendIntroEmail] candidate fetch error:', JSON.stringify(candError));
    if (jobError) console.error('[sendIntroEmail] job fetch error:', JSON.stringify(jobError));

    if (!candidate?.email) {
      return { ok: false, status: 422, error: 'Candidate email missing' };
    }

    const { subject, html } = buildIntroEmail({ introId, intro, job });

    const emailResult = await resend.emails.send({
      from: 'SFC Talent <noreply@strategicfinancecareers.com>',
      to: candidate.email,
      subject,
      html,
    });
    if (emailResult?.error) {
      return { ok: false, status: 502, error: emailResult.error.message || String(emailResult.error) };
    }
    return { ok: true, emailResult };
  } catch (err) {
    return { ok: false, status: 500, error: err?.message || String(err) };
  }
}
