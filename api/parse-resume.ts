import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore - ESM JS helpers, no .d.ts files
import { rateLimit, clientIp } from './_shared/rateLimit.js';

const limiterClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ~6 MB of base64 is about a 4.5 MB PDF (also Vercel's body limit).
// Resumes are a fraction of this; anything bigger is abuse or a mis-upload.
const MAX_BASE64_CHARS = 6 * 1024 * 1024;

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
  // Phase 4 of the skills redesign: résumé-driven Areas of Expertise
  // suggestions. The client seeds form.areasOfExpertise from this
  // when empty, and shows the same set under "Recommended from your
  // résumé". Tools suggestions reuse the existing `skills` field —
  // same data, two UI roles, no payload duplication.
  suggestedAreas: [],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { resumeBase64, filename } = req.body;

    if (!resumeBase64) {
      return res.status(200).json(EMPTY_PARSE);
    }
    if (typeof resumeBase64 !== 'string' || resumeBase64.length > MAX_BASE64_CHARS) {
      return res.status(413).json({ error: 'Resume file is too large. Please upload a PDF under 4 MB.' });
    }

    // Anti-abuse: this endpoint is public (pre-signup) and each call costs
    // real Anthropic credits. Per-IP for individuals, a global cap as a
    // circuit breaker against distributed abuse. Fails open on DB errors.
    const ip = clientIp(req);
    const [ipOk, globalOk] = await Promise.all([
      rateLimit(limiterClient, `parse:${ip}`, { windowSeconds: 600, max: 10 }),
      rateLimit(limiterClient, 'parse:global', { windowSeconds: 3600, max: 120 }),
    ]);
    if (!ipOk || !globalOk) {
      return res.status(429).json({ error: 'Too many resume uploads right now. Please wait a few minutes and try again.' });
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
{"currentRole":"most recent job title","currentCompany":"most recent company name","location":"city, state only","yearsExperience":5,"education":"degree type and field only, no school name e.g. BS Economics","educationLevel":"Bachelors","skills":["Excel","SQL","Tableau"],"bio":"2-3 sentence professional summary in third person. No names, no company names, no school names. Focus on experience level and skills only.","sectors":["Fintech","Consumer"],"suggestedAreas":["M&A","Financial Modeling","Fundraising","Capital Markets","Investor Relations"]}
educationLevel must be one of: Bachelors, Masters, MBA, PhD, Other
skills = concrete tools and technical skills the candidate has used (Excel, SQL, Tableau, NetSuite, HubSpot, ChatGPT, Anaplan, etc.) — NOT functional areas. Up to ~10 entries.
suggestedAreas = functional finance Areas of Expertise the candidate has meaningfully worked in (M&A, FP&A, Capital Markets, Pricing & Packaging, Treasury, Strategic Planning, Investor Relations, Corporate Development, Financial Modeling, etc.) — the strategic/conceptual side, distinct from tools. Up to ~10 entries; prefer commonly-used finance terminology.
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
      // Phase 4: Areas of Expertise suggestions seeded into the
      // wizard's search-and-suggest picker on Tab 3.
      suggestedAreas: Array.isArray(parsed.suggestedAreas) ? parsed.suggestedAreas : [],
    });

  } catch (error: any) {
    console.error('[parse-resume] unhandled error:', error.message);
    return res.status(200).json(EMPTY_PARSE);
  }
}
