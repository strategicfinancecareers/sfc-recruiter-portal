// Shared resume-parser core extracted from api/parse-resume.ts so other
// endpoints can re-parse without a serverless-to-serverless HTTP hop
// (which previously bit us on internal calls due to Vercel deployment-
// protection on the *-{deployment} preview URLs). Used by:
//   - api/parse-resume.ts (the candidate's initial parse during /apply)
//   - api/update-candidate-resume.js when the candidate sets
//     reparse=true while replacing the default resume
//
// Returns the same shape parse-resume returns: a JSON object with the
// canonical fields the candidate's profile is keyed on, or a
// parseError:true fallback. Never throws — Claude failures degrade
// gracefully to the empty shape so callers can decide what to do.

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
  // Phase 4 of the skills redesign: kept in sync with parse-resume.ts.
  suggestedAreas: [],
};

const SYSTEM_PROMPT = `You are a resume parser for a finance recruiting platform. Extract information and return ONLY valid JSON with no markdown, no backticks, no explanation. Return exactly this structure:
{"currentRole":"most recent job title","currentCompany":"most recent company name","location":"city, state only","yearsExperience":5,"education":"degree type and field only, no school name e.g. BS Economics","educationLevel":"Bachelors","skills":["Excel","SQL","Tableau"],"bio":"2-3 sentence professional summary in third person. No names, no company names, no school names. Focus on experience level and skills only.","sectors":["Fintech","Consumer"],"suggestedAreas":["M&A","Financial Modeling","Fundraising","Capital Markets","Investor Relations"]}
educationLevel must be one of: Bachelors, Masters, MBA, PhD, Other
skills = concrete tools and technical skills the candidate has used (Excel, SQL, Tableau, NetSuite, HubSpot, ChatGPT, Anaplan, etc.) — NOT functional areas. Up to ~10 entries.
suggestedAreas = functional finance Areas of Expertise the candidate has meaningfully worked in (M&A, FP&A, Capital Markets, Pricing & Packaging, Treasury, Strategic Planning, Investor Relations, Corporate Development, Financial Modeling, etc.) — the strategic/conceptual side, distinct from tools. Up to ~10 entries; prefer commonly-used finance terminology.
Return ONLY the JSON object, nothing else.`;

export async function parseResumeWithClaude(resumeBase64) {
  if (!resumeBase64) return { ...EMPTY_PARSE };

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
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: resumeBase64 } },
            { type: 'text', text: 'Parse this resume and return the JSON as instructed. Return ONLY the JSON object, nothing else.' },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.content?.[0]?.text) {
      console.error('[parseResumeWithClaude] Claude error:', JSON.stringify(data));
      return { ...EMPTY_PARSE };
    }
    const rawText = data.content[0].text;

    let parsed = null;
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      try {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch { /* fall through */ }
    }
    if (!parsed) {
      console.warn('[parseResumeWithClaude] JSON parse failed. Raw snippet:', rawText.slice(0, 300));
      return { ...EMPTY_PARSE };
    }

    return {
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
      suggestedAreas: Array.isArray(parsed.suggestedAreas) ? parsed.suggestedAreas : [],
    };
  } catch (err) {
    console.error('[parseResumeWithClaude] unhandled:', err?.message || err);
    return { ...EMPTY_PARSE };
  }
}

export { EMPTY_PARSE };
