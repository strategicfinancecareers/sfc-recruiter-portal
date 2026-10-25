import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - ESM JS helpers, no .d.ts files
import { getAuthedUser } from './_shared/requireAuth.js';
// @ts-ignore - ESM JS helpers, no .d.ts files
import { rateLimit } from './_shared/rateLimit.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { role, bio, skills, experience, education } = req.body;

    if (!role && !bio) {
      return res.status(200).json({ bullets: [] });
    }

    // Signed-in users only (recruiters browsing), with a per-user cap -
    // each call spends Anthropic credits.
    const caller = await getAuthedUser(req, supabase);
    if ((caller as any).error) {
      return res.status((caller as any).status).json({ error: (caller as any).error });
    }
    const insightLimitOk = await rateLimit(supabase, `insight:${(caller as any).userId}`, { windowSeconds: 3600, max: 100 });
    if (!insightLimitOk) {
      return res.status(429).json({ error: 'Too many requests this hour. Please try again later.' });
    }

    const userMsg = [
      `Role: ${role || 'Finance Professional'}`,
      bio ? `Bio: ${bio}` : '',
      skills?.length ? `Skills: ${(skills as string[]).slice(0, 12).join(', ')}` : '',
      experience ? `Experience: ${experience} years` : '',
      education ? `Education: ${education}` : '',
    ].filter(Boolean).join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 1500,
        system: 'You are a talent analyst. Based on this candidate profile, generate exactly 3-4 concise bullet points explaining why this candidate stands out to a recruiter. Focus on impact, seniority, and unique value. Keep each bullet under 15 words. No fluff. Return ONLY a JSON array of strings, e.g. ["bullet 1","bullet 2","bullet 3"]. No markdown, no explanation.',
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await response.json();
    // Current Claude models return a thinking block before the text block.
    const raw = (Array.isArray(data.content) ? data.content.find((b: any) => b.type === 'text')?.text : null) || '[]';

    let bullets: string[] = [];
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      bullets = JSON.parse(cleaned);
      if (!Array.isArray(bullets)) bullets = [];
    } catch {
      // Try extracting array
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) {
        try { bullets = JSON.parse(match[0]); } catch { bullets = []; }
      }
    }

    return res.status(200).json({ bullets: bullets.slice(0, 4) });
  } catch (error: any) {
    console.error('[generate-candidate-insight] error:', error.message);
    return res.status(200).json({ bullets: [] });
  }
}
