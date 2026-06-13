import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { scrubSfcTakeFields } from './_shared/scrubName.js';

// POST /api/generate-sfc-take
// body: { candidateId, adminUserId? }
//
// Drafts an SFC Take via Claude. Writes back to candidates.sfc_take +
// sfc_role_fit/strengths/considerations + sfc_take_draft_generated_at +
// sfc_take_model. NEVER touches sfc_take_published_at (publish is a
// separate explicit admin action).
//
// Auth: either adminUserId is admin|owner, OR the request carries an
// x-internal-call header matching INTERNAL_API_SECRET (used by the
// auto-draft hook in submit-candidate).
//
// Direct fetch to api.anthropic.com (matches the pattern of
// parse-resume.ts / fetch-job.ts / generate-candidate-insight.ts —
// no @anthropic-ai/sdk in the repo).

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-6';
const MAX_TOKENS = 2000;

interface AnthropicMsg {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

// Extract <tag>...</tag> body. Returns trimmed content or null.
function extractTag(raw: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const m = raw.match(re);
  return m ? m[1].trim() : null;
}

// Parse a bullet list — lines starting with '- ' or '• '.
function parseBullets(block: string | null): string[] {
  if (!block) return [];
  return block
    .split('\n')
    .map(line => line.trim())
    .filter(line => /^[-•]\s+/.test(line))
    .map(line => line.replace(/^[-•]\s+/, '').trim())
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  const { candidateId, adminUserId } = (req.body || {}) as { candidateId?: string; adminUserId?: string };
  const internalHeader = req.headers['x-internal-call'];
  const internalCall =
    typeof internalHeader === 'string' &&
    internalHeader.length > 0 &&
    !!process.env.INTERNAL_API_SECRET &&
    internalHeader === process.env.INTERNAL_API_SECRET;

  console.log('[generate-sfc-take] entry — candidateId:', candidateId, 'internalCall:', internalCall, 'adminUserId:', adminUserId);

  if (!candidateId) return res.status(400).json({ error: 'candidateId required' });

  // ── Auth ──────────────────────────────────────────────────────────────────
  if (!internalCall) {
    if (!adminUserId) return res.status(401).json({ error: 'adminUserId required (or x-internal-call header)' });
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id, is_active, roles ( name )')
      .eq('id', adminUserId)
      .maybeSingle();
    if (userErr) {
      console.error('[generate-sfc-take] user lookup failed:', JSON.stringify(userErr));
      return res.status(500).json({ error: userErr.message });
    }
    const roleName = (userRow as any)?.roles?.name;
    if (!userRow || (userRow as any).is_active === false || (roleName !== 'admin' && roleName !== 'owner')) {
      console.warn('[generate-sfc-take] auth FAIL — role:', roleName);
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // ── Load candidate ────────────────────────────────────────────────────────
  // NOTE: candidates table doesn't store raw resume_text or current_company /
  // target_company_stages. The structured fields (label, profile_description,
  // primary_background, etc.) are derived from the parsed resume by
  // api/parse-resume during /apply submission, so they're our best signal.
  // The resume_full_url is a private storage path — included as context but
  // Claude won't fetch it; v1 limitation flagged in the response.
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    // display_name needed so the post-generation scrub can substitute
    // real-name occurrences in the model output with the anonymized
    // handle before persisting (recruiters must never see the real
    // name in the rendered take; the recruiter SELECT also no longer
    // ships `name` to the browser, so the scrub MUST happen at write
    // time).
    // Phase 3 of the skills redesign: prefer areas_of_expertise (the
    // new controlled-taxonomy field) and fall back to
    // detailed_experience for candidates who haven't re-edited since
    // Phase 2 shipped. Both columns are kept in sync via the wizard's
    // dual-write; Phase 5 drops detailed_experience and this SELECT
    // narrows to areas_of_expertise alone.
    .select(`
      id, name, display_name, label, location, experience, education, highest_education_level,
      profile_description, work_preference, target_salary, target_roles,
      preferred_cities, primary_background, secondary_backgrounds,
      areas_of_expertise, detailed_experience, resume_full_url
    `)
    .eq('id', candidateId)
    .maybeSingle();
  if (candErr) {
    console.error('[generate-sfc-take] candidate fetch failed:', JSON.stringify(candErr));
    return res.status(500).json({ error: candErr.message });
  }
  if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

  // Skills via candidate_skills join
  const { data: skillsData } = await supabase
    .from('candidate_skills')
    .select('skills(skill)')
    .eq('candidate_id', candidateId);
  const skills = ((skillsData as any[]) || [])
    .map(s => s.skills?.skill)
    .filter(Boolean) as string[];

  // ── Load framework from app_settings ──────────────────────────────────────
  const { data: fwRow, error: fwErr } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'sfc_framework')
    .maybeSingle();
  if (fwErr) {
    console.error('[generate-sfc-take] framework fetch failed:', JSON.stringify(fwErr));
    return res.status(500).json({ error: fwErr.message });
  }
  // value is JSONB — could be a JSON string or a raw string depending on
  // how it was inserted. Normalize either way.
  const fwRaw = (fwRow as any)?.value;
  const framework: string =
    typeof fwRaw === 'string'
      ? fwRaw
      : (fwRaw == null ? '' : JSON.stringify(fwRaw));
  if (!framework) {
    return res.status(500).json({ error: 'sfc_framework setting is empty' });
  }

  // ── Build prompt ──────────────────────────────────────────────────────────
  const c: any = candidate;
  const targetRoles = Array.isArray(c.target_roles) ? c.target_roles.join(', ') : '';
  const targetCities = Array.isArray(c.preferred_cities) ? c.preferred_cities.join(', ') : '';
  // Phase 3: prefer the new controlled-taxonomy field; fall back to
  // the legacy detailed_experience so existing candidates' takes
  // don't degrade. Either way the join(', ') formatting is preserved.
  const areasArr: string[] = (Array.isArray((c as any).areas_of_expertise) && (c as any).areas_of_expertise.length > 0)
    ? (c as any).areas_of_expertise
    : (Array.isArray(c.detailed_experience) ? c.detailed_experience : []);
  const areasOfExpertiseStr = areasArr.join(', ');
  const secondary = Array.isArray(c.secondary_backgrounds) ? c.secondary_backgrounds.join(', ') : '';

  const userMessage = [
    'Draft an SFC Take for this candidate following the framework above.',
    '',
    // ANONYMITY: the Take is rendered to recruiters who have NOT been
    // approved for an intro yet, so it must not contain the real name.
    // We tell the model to use the anonymized handle (and post-process
    // with a name-scrub regardless, as a safety net).
    'ANONYMITY: This take will be shown to recruiters BEFORE they request',
    'an introduction. Do NOT use the candidate\'s real name anywhere in',
    `your output. Refer to them as "${c.display_name || 'the candidate'}" or with neutral language`,
    '("this candidate", "they", etc.). Their real name is provided below only as',
    'context — never echo it back.',
    '',
    'CANDIDATE CONTEXT:',
    `Name (DO NOT USE IN OUTPUT): ${c.name}`,
    `Anonymized handle (use this if you need a label): ${c.display_name || '—'}`,
    `Current role / label: ${c.label || '—'}`,
    `Years experience: ${c.experience ?? '—'}`,
    `Location: ${c.location || '—'}`,
    `Education: ${c.education || '—'}${c.highest_education_level ? ` (${c.highest_education_level})` : ''}`,
    `Primary background: ${c.primary_background || '—'}`,
    secondary ? `Secondary backgrounds: ${secondary}` : '',
    areasOfExpertiseStr ? `Areas of Expertise: ${areasOfExpertiseStr}` : '',
    `Target roles: ${targetRoles || '—'}`,
    `Target comp: ${c.target_salary || '—'}`,
    `Work preference: ${c.work_preference || '—'}`,
    targetCities ? `Preferred cities: ${targetCities}` : '',
    `Skills: ${skills.length ? skills.join(', ') : '—'}`,
    '',
    'Bio (candidate-written):',
    c.profile_description || '(none)',
    '',
    c.resume_full_url
      ? `Resume on file at storage path: ${c.resume_full_url} (you cannot fetch this; use the structured fields above)`
      : 'No resume on file.',
    '',
    'Return your draft in this EXACT format (the XML tags are required for parsing):',
    '',
    '<sfc_take>',
    '[120-180 word prose analysis. Confident, specific, opinionated. Identify the path (A/B/C/D-Pattern). Read for actual work, not titles.]',
    '</sfc_take>',
    '',
    '<sfc_role_fit>',
    '- [Specific role + company stage match]',
    '- [...]',
    '- [3-5 entries]',
    '</sfc_role_fit>',
    '',
    '<sfc_strengths>',
    '- [Evidence-grounded strength]',
    '- [...]',
    '- [3-5 entries]',
    '</sfc_strengths>',
    '',
    '<sfc_considerations>',
    '- [Honest pre-sell, framed as positioning info]',
    '- [...]',
    '- [1-3 entries]',
    '</sfc_considerations>',
  ].filter(Boolean).join('\n');

  // ── Call Anthropic ────────────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[generate-sfc-take] ANTHROPIC_API_KEY missing');
    return res.status(500).json({ error: 'AI not configured' });
  }

  let anthropicJson: AnthropicMsg;
  try {
    const resp = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: framework,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[generate-sfc-take] Anthropic non-200:', resp.status, errText);
      return res.status(502).json({ error: 'Anthropic API error', status: resp.status, detail: errText });
    }
    anthropicJson = await resp.json();
  } catch (err: any) {
    console.error('[generate-sfc-take] Anthropic fetch threw:', err?.message || err);
    return res.status(502).json({ error: 'Anthropic fetch failed', message: err?.message || String(err) });
  }

  const raw = anthropicJson.content?.[0]?.text || '';
  console.log('[generate-sfc-take] model:', MODEL, 'usage:', JSON.stringify(anthropicJson.usage || {}));

  // ── Parse XML tags ────────────────────────────────────────────────────────
  const takeText = extractTag(raw, 'sfc_take');
  const roleFitBlock = extractTag(raw, 'sfc_role_fit');
  const strengthsBlock = extractTag(raw, 'sfc_strengths');
  const considBlock = extractTag(raw, 'sfc_considerations');

  if (!takeText || !roleFitBlock || !strengthsBlock || !considBlock) {
    console.error('[generate-sfc-take] parse FAIL — raw output:', raw);
    return res.status(500).json({
      error: 'Failed to parse Anthropic response — missing one or more XML tags',
      rawPreview: raw.slice(0, 800),
    });
  }

  const sfc_role_fit_raw = parseBullets(roleFitBlock);
  const sfc_strengths_raw = parseBullets(strengthsBlock);
  const sfc_considerations_raw = parseBullets(considBlock);

  // ── Real-name scrub (safety net) ──────────────────────────────────────────
  // The prompt instructs the model NOT to use the real name; this is
  // the belt-and-suspenders pass that guarantees the persisted take +
  // bullet arrays never contain it. After this point the DB row is
  // safe to ship to recruiters without the client having to know the
  // real name (and the recruiter SELECT no longer includes `name`).
  const scrubbed = scrubSfcTakeFields(
    {
      sfc_take: takeText,
      sfc_role_fit: sfc_role_fit_raw,
      sfc_strengths: sfc_strengths_raw,
      sfc_considerations: sfc_considerations_raw,
    },
    c.name,
    c.display_name
  );
  const scrubbedTake = scrubbed.sfc_take;
  const sfc_role_fit = scrubbed.sfc_role_fit;
  const sfc_strengths = scrubbed.sfc_strengths;
  const sfc_considerations = scrubbed.sfc_considerations;

  // ── Persist (do NOT touch sfc_take_published_at) ──────────────────────────
  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('candidates')
    .update({
      sfc_take: scrubbedTake,
      sfc_role_fit,
      sfc_strengths,
      sfc_considerations,
      sfc_take_draft_generated_at: nowIso,
      sfc_take_model: MODEL,
      updated_at: nowIso,
    })
    .eq('id', candidateId);
  if (updateErr) {
    console.error('[generate-sfc-take] candidates UPDATE failed:', JSON.stringify(updateErr));
    return res.status(500).json({ error: updateErr.message });
  }

  return res.status(200).json({
    success: true,
    candidateId,
    sfc_take: scrubbedTake,
    sfc_role_fit,
    sfc_strengths,
    sfc_considerations,
    sfc_take_draft_generated_at: nowIso,
    sfc_take_model: MODEL,
    usage: anthropicJson.usage || null,
  });
}
