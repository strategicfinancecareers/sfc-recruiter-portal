import { createClient } from '@supabase/supabase-js';

// POST /api/accept-recruiter-agreement
// body: { initialsFee, initialsComms, signature, termsVersion }
//
// Records a recruiter's signature on the Recruiter Terms and Conditions as
// its own step, separate from checkout (Getting Started step 2). Checkout
// then verifies the signature exists rather than collecting it.
//
// Unlike the other recruiter endpoints, this one does NOT take a userId
// from the body: a legally binding signature must be attributable, so the
// caller is identified from their Supabase access token and the row is
// written for that user only. Send it with authedFetch.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // ── Identify the signer from their bearer token ──────────────────────
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Sign in required to accept the agreement.' });
  }
  const { data: authData, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authData?.user?.id) {
    console.warn('[accept-recruiter-agreement] auth FAIL:', authErr?.message);
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
  const signerId = authData.user.id;

  // ── Validate the signature block ─────────────────────────────────────
  const { initialsFee, initialsComms, signature, termsVersion } = req.body || {};
  const feeInit = (initialsFee || '').trim();
  const commsInit = (initialsComms || '').trim();
  const signed = (signature || '').trim();

  if (!feeInit || !commsInit || feeInit.length > 8 || commsInit.length > 8) {
    return res.status(400).json({ error: 'Initials on both key items are required.' });
  }
  if (signed.length < 2 || signed.length > 120) {
    return res.status(400).json({ error: 'A typed full name is required to sign.' });
  }

  const acceptedAt = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('users')
    .update({
      recruiter_agreement_accepted_at: acceptedAt,
      recruiter_agreement_initials_fee: feeInit,
      recruiter_agreement_initials_comms: commsInit,
      recruiter_agreement_signature: signed,
      recruiter_agreement_version: (termsVersion || '1.0').slice(0, 16),
      updated_at: acceptedAt,
    })
    .eq('id', signerId);

  if (updateErr) {
    console.error('[accept-recruiter-agreement] update failed:', updateErr.message);
    return res.status(500).json({ error: 'Could not record your signature. Please try again.' });
  }

  console.log('[accept-recruiter-agreement] signed by', signerId);
  return res.status(200).json({ success: true, acceptedAt });
}
