import type { VercelRequest, VercelResponse } from '@vercel/node';

const EMPTY_PARSE = {
  parseError: true,
  currentRole: '',
  currentCompany: '',
  location: '',
  yearsExperience: 0,
  education: '',
  educationLevel: 'Bachelors',
  skills: [],
  bio: '',
  sectors: [],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { resumeText } = req.body;

    if (!resumeText || resumeText.length < 50) {
      // Still return a parseable empty object so the form can continue
      return res.status(200).json(EMPTY_PARSE);
    }

    let rawText = '';

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `You are a resume parser for a finance recruiting platform. Extract information and return ONLY valid JSON with no extra text, no markdown, no code fences. Return exactly this structure:
{"currentRole":"most recent job title","currentCompany":"most recent company","location":"city, state only","yearsExperience":5,"education":"degree and field only e.g. MBA Finance","educationLevel":"Bachelors","skills":["skill1","skill2"],"bio":"2-3 sentence anonymous professional summary in third person with no company or school names","sectors":["Fintech"]}
Valid educationLevel values: Bachelors, Masters, MBA, PhD
Valid sectors: Fintech, Consumer/CPG, SaaS/Technology, Healthcare, Real Estate, Private Equity, Investment Banking, Consulting, Energy, Media, Marketplace, Financial Services
Return ONLY the JSON object. No other text.`,
          messages: [{ role: 'user', content: `Parse this resume:\n\n${resumeText.slice(0, 5000)}` }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[parse-resume] Claude API error:', JSON.stringify(data));
        return res.status(200).json(EMPTY_PARSE);
      }

      rawText = data.content?.[0]?.text || '';
    } catch (fetchErr: any) {
      console.error('[parse-resume] fetch error:', fetchErr.message);
      return res.status(200).json(EMPTY_PARSE);
    }

    // Robust JSON extraction — strip any accidental markdown/whitespace
    let parsed: any = null;

    // Try 1: direct parse after trimming fences
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Try 2: extract first {...} block
      try {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch {
        // fall through
      }
    }

    if (!parsed) {
      console.warn('[parse-resume] JSON parse failed, rawText snippet:', rawText.slice(0, 200));
      return res.status(200).json(EMPTY_PARSE);
    }

    // Sanitise — ensure expected fields exist
    return res.status(200).json({
      parseError: false,
      currentRole: parsed.currentRole || '',
      currentCompany: parsed.currentCompany || '',
      location: parsed.location || '',
      yearsExperience: typeof parsed.yearsExperience === 'number' ? parsed.yearsExperience : 0,
      education: parsed.education || '',
      educationLevel: parsed.educationLevel || 'Bachelors',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      bio: parsed.bio || '',
      sectors: Array.isArray(parsed.sectors) ? parsed.sectors : [],
    });
  } catch (error: any) {
    console.error('[parse-resume] unhandled error:', error.message);
    // Always return 200 with empty parse so the form can continue
    return res.status(200).json(EMPTY_PARSE);
  }
}
