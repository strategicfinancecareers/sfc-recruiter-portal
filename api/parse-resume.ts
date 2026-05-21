import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { resumeText } = req.body;

    if (!resumeText || resumeText.length < 50) {
      return res.status(400).json({ error: 'Resume text too short or empty' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: `You are a resume parser for a finance recruiting platform. Extract information and return ONLY valid JSON with these exact fields:
{
  "currentRole": "most recent job title",
  "currentCompany": "most recent company (will be hidden from recruiters)",
  "location": "city, state only — no country",
  "yearsExperience": <number>,
  "education": "degree and field only, no school name e.g. 'MBA, Finance'",
  "educationLevel": "Bachelors or Masters or MBA or PhD",
  "skills": ["array", "of", "specific", "finance", "skills"],
  "bio": "2-3 sentence anonymous professional summary in third person. DO NOT mention company names, school names, or any identifying information. Focus on skills, experience level, and value delivered.",
  "sectors": ["industries they have worked in from: Fintech, Consumer/CPG, SaaS/Technology, Healthcare, Real Estate, Private Equity, Investment Banking, Consulting, Energy, Media, Marketplace, Financial Services"]
}
Return only JSON, no markdown, no explanation.`,
        messages: [{ role: 'user', content: `Parse this resume:\n\n${resumeText.slice(0, 6000)}` }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[parse-resume] Claude error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Claude API error', detail: data });
    }

    const rawText = data.content?.[0]?.text || '';
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error('[parse-resume] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
