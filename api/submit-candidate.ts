import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const NOTIFY_EMAIL = 'zu@strategicfinancecareers.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      // Identity
      firstName, lastName, email, phone, linkedin,
      // Parsed profile
      currentRole, location, yearsExperience, education, educationLevel,
      bio, skills, sectors,
      // Availability
      jobSearchStatus, targetComp, preferredLocations, targetRoles, openToRelocation,
      // Resume
      resumeBase64, resumeFileName,
    } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for duplicate email
    const { data: existing } = await supabase
      .from('candidates')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'An application with this email already exists.' });
    }

    // Upload resume to Supabase Storage if provided
    let resumeUrl: string | null = null;
    if (resumeBase64 && resumeFileName) {
      try {
        const buffer = Buffer.from(resumeBase64, 'base64');
        const safeFileName = `${Date.now()}_${(firstName + '_' + lastName).replace(/\s+/g, '_')}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(`candidates/${safeFileName}`, buffer, {
            contentType: 'application/pdf',
            upsert: false,
          });
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(uploadData.path);
          resumeUrl = urlData?.publicUrl || null;
        } else {
          console.warn('[submit-candidate] resume upload error:', uploadError?.message);
        }
      } catch (uploadErr: any) {
        console.warn('[submit-candidate] resume upload threw:', uploadErr.message);
      }
    }

    // Build anonymous display name
    const expNum = Number(yearsExperience) || 0;
    const expLabel = expNum >= 10 ? '10+' : expNum >= 5 ? '5+' : expNum >= 2 ? '2+' : '1+';
    const displayName = currentRole
      ? `${currentRole} · ${expLabel} yrs`
      : `Finance Professional · ${expLabel} yrs`;

    // Build profile description
    const availabilityNote = [
      jobSearchStatus ? `Job search status: ${jobSearchStatus}.` : '',
      targetComp ? `Target comp: ${targetComp}.` : '',
      preferredLocations?.length ? `Open to: ${preferredLocations.join(', ')}.` : '',
      openToRelocation ? 'Open to relocation.' : '',
    ].filter(Boolean).join(' ');

    const profileDescription = [bio, availabilityNote].filter(Boolean).join('\n\n');

    // Insert candidate (status field requires migration: ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active')
    const { data: candidate, error: insertError } = await supabase
      .from('candidates')
      .insert({
        name: `${firstName} ${lastName}`,
        display_name: displayName,
        email,
        phone: phone || null,
        location: location || 'United States',
        experience: expNum,
        education: education || 'Finance',
        highest_education_level: educationLevel || null,
        label: currentRole || 'Finance Professional',
        profile_description: profileDescription || null,
        open_to_opportunities: true,
        resume_full_url: resumeUrl,
        resume_redacted_url: null,
        status: 'pending_review',
      } as any)
      .select('id')
      .single();

    if (insertError) {
      console.error('[submit-candidate] insert error:', insertError);
      return res.status(500).json({ error: 'Failed to save application', detail: insertError.message });
    }

    const candidateId = candidate.id;

    // Insert skills
    if (Array.isArray(skills) && skills.length > 0) {
      for (const skillName of skills) {
        if (!skillName?.trim()) continue;
        // Upsert skill
        const { data: skillRow } = await supabase
          .from('skills')
          .upsert({ skill: skillName.trim() }, { onConflict: 'skill' })
          .select('id')
          .single();
        if (skillRow?.id) {
          await supabase.from('candidate_skills').insert({
            candidate_id: candidateId,
            skill_id: skillRow.id,
          });
        }
      }
    }

    // Send notification email
    const sectorList = Array.isArray(sectors) && sectors.length > 0
      ? sectors.join(', ')
      : 'Not specified';
    const roleList = Array.isArray(targetRoles) && targetRoles.length > 0
      ? targetRoles.join(', ')
      : 'Not specified';

    const emailHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
      + '<h2 style="color:#0F6E56;margin-bottom:4px">New Candidate Application</h2>'
      + '<p style="color:#666;margin-top:0">A new candidate has submitted their profile for review.</p>'
      + '<table style="width:100%;border-collapse:collapse;margin:20px 0">'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;width:40%">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">' + firstName + ' ' + lastName + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + email + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (phone || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">LinkedIn</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (linkedin || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Role</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (currentRole || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Location</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (location || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Experience</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + expNum + ' years</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Education</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (education || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Target Comp</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (targetComp || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Job Status</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (jobSearchStatus || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Sectors</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + sectorList + '</td></tr>'
      + '<tr><td style="padding:8px 0;color:#888">Target Roles</td><td style="padding:8px 0">' + roleList + '</td></tr>'
      + '</table>'
      + (bio ? '<div style="margin:16px 0;padding:16px;background:#f9f9f9;border-radius:8px"><p style="color:#666;font-size:12px;margin:0 0 8px">Bio</p><p style="margin:0;color:#333">' + bio + '</p></div>' : '')
      + (resumeUrl ? '<div style="margin:20px 0"><a href="' + resumeUrl + '" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600">View Resume →</a></div>' : '<p style="color:#888;font-size:13px">No resume uploaded.</p>')
      + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
      + '<p style="color:#aaa;font-size:12px">Review this application in the SFC Admin portal.</p>'
      + '</div>';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'SFC Talent <noreply@strategicfinancecareers.com>',
        to: [NOTIFY_EMAIL],
        subject: `New Candidate Application: ${firstName} ${lastName} — ${currentRole || 'Finance Professional'}`,
        html: emailHtml,
      }),
    });

    return res.status(200).json({ success: true, candidateId });
  } catch (error: any) {
    console.error('[submit-candidate] error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
