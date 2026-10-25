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
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL required' });
  }

  // Signed-in users only (recruiters importing a job posting), with a
  // per-user cap: this endpoint fetches an arbitrary URL server-side and
  // spends Anthropic credits, so it must not be anonymous.
  const caller = await getAuthedUser(req, supabase);
  if ((caller as any).error) {
    return res.status((caller as any).status).json({ error: (caller as any).error });
  }
  if (!(caller as any).isActive) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const jobLimitOk = await rateLimit(supabase, `fetchjob:${(caller as any).userId}`, { windowSeconds: 3600, max: 20 });
  if (!jobLimitOk) {
    return res.status(429).json({ error: 'Too many job imports this hour. Please try again later.' });
  }

  let step = 'fetching url';

  try {
    // Step 1: Fetch the job page
    const pageResponse = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobParser/1.0)' }
    });
    const html = await pageResponse.text();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000);

    step = 'calling claude';

    // Step 2: Call Claude API server-side
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-5-5',
        max_tokens: 2500,
        system: 'You are a job posting parser. Extract ALL details from this job posting text and return ONLY valid JSON with these fields: title, company, location, type (one of: full-time, part-time, contract, remote), salary_range (look carefully for any compensation, salary, pay range, or total compensation mentioned anywhere in the posting — include the full range as a string like \'$150,000 - $200,000\'), description, requirements. If salary is truly not mentioned anywhere use null. Return only valid JSON, no markdown.',
        messages: [{ role: 'user', content: `Extract job details from this text: ${text}` }]
      })
    });

    step = 'parsing claude response';

    const claudeData = await claudeResponse.json();

    step = 'extracting content';

    if (!claudeResponse.ok) {
      return res.status(500).json({
        error: 'Failed',
        message: `Claude API returned ${claudeResponse.status}: ${JSON.stringify(claudeData)}`,
        step
      });
    }

    // Current Claude models return a thinking block before the text block.
    const jobTextBlock = Array.isArray(claudeData.content)
      ? claudeData.content.find((b: any) => b.type === 'text')
      : null;
    if (!jobTextBlock?.text) {
      return res.status(500).json({ error: 'Failed', message: 'No text block in Claude response', step });
    }
    const content = jobTextBlock.text;

    step = 'parsing job JSON';

    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const jobData = JSON.parse(cleaned);

    return res.status(200).json(jobData);
  } catch (error: any) {
    console.error('Job import error at step:', step, error);
    return res.status(500).json({
      error: 'Failed',
      message: error?.message || String(error),
      step
    });
  }
}
