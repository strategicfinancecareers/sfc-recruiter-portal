import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    // Step 1: Fetch the job page
    const pageResponse = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobParser/1.0)' }
    });
    const html = await pageResponse.text();
    const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);

    // Step 2: Call Claude API server-side
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: 'You are a job posting parser. Extract job details and return ONLY valid JSON with fields: title, company, location, type (one of: full-time, part-time, contract, remote), salary_range, description, requirements. Use null for unknown fields. No markdown, no explanation, just JSON.',
        messages: [{ role: 'user', content: `Extract job details from this text: ${text}` }]
      })
    });

    const claudeData = await claudeResponse.json();
    const content = claudeData.content[0].text;
    const jobData = JSON.parse(content);

    return res.status(200).json(jobData);
  } catch (error) {
    console.error('Job import error:', error);
    return res.status(500).json({ error: 'Failed to parse job posting' });
  }
}
