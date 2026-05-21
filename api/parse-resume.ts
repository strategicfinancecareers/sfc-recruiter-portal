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
    const { resumeBase64, filename } = req.body;

    if (!resumeBase64) {
      return res.status(200).json(EMPTY_PARSE);
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
        max_tokens: 1500,
        system: `You are a resume parser for a finance recruiting platform. Extract information and return ONLY valid JSON with no markdown, no backticks, no explanation. Return exactly this structure:
{"currentRole":"most recent job title","currentCompany":"most recent company name","location":"city, state only","yearsExperience":5,"education":"degree type and field only, no school name e.g. BS Economics","educationLevel":"Bachelors","skills":["Financial Modeling","Excel","SQL"],"bio":"2-3 sentence professional summary in third person. No names, no company names, no school names. Focus on experience level and skills only.","sectors":["Fintech","Consumer"]}
educationLevel must be one of: Bachelors, Masters, MBA, PhD, Other
Return ONLY the JSON object, nothing else.`,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: resumeBase64,
              },
            },
            {
              type: 'text',
              text: 'Parse this resume and return the JSON as instructed. Return ONLY the JSON object, nothing else.',
            },
          ],
        }],
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.content?.[0]?.text) {
      console.error('[parse-resume] Claude error:', JSON.stringify(data));
      return res.status(200).json(EMPTY_PARSE);
    }

    const rawText = data.content[0].text;

    // Robust JSON extraction
    let parsed: any = null;

    // Try 1: strip any accidental markdown fences
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Try 2: extract first { ... } block
      try {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch {
        // fall through to empty
      }
    }

    if (!parsed) {
      console.warn('[parse-resume] JSON parse failed. Raw snippet:', rawText.slice(0, 300));
      return res.status(200).json(EMPTY_PARSE);
    }

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
    return res.status(200).json(EMPTY_PARSE);
  }
}
