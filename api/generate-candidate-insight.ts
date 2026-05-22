import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { role, bio, skills, experience, education } = req.body;

    if (!role && !bio) {
      return res.status(200).json({ bullets: [] });
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
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: 'You are a talent analyst. Based on this candidate profile, generate exactly 3-4 concise bullet points explaining why this candidate stands out to a recruiter. Focus on impact, seniority, and unique value. Keep each bullet under 15 words. No fluff. Return ONLY a JSON array of strings, e.g. ["bullet 1","bullet 2","bullet 3"]. No markdown, no explanation.',
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await response.json();
    const raw = data.content?.[0]?.text || '[]';

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
