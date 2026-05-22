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
      // Background segmentation
      primaryBackground, secondaryBackgrounds, detailedExperience,
      // Availability
      jobSearchStatus, targetComp, workPreference, preferredCities, targetRoles,
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
          .upload(`candidates/${safeFileName}`, buffer, { contentType: 'application/pdf', upsert: false });
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

    // Build display name and profile description — all fields have safe fallbacks
    const expNum = Number(yearsExperience) || 0;
    const expLabel = expNum >= 10 ? '10+' : expNum >= 5 ? '5+' : expNum >= 2 ? '2+' : '1+';
    const safeRole = (currentRole || primaryBackground || 'Finance Professional').trim();
    const safeSector = Array.isArray(sectors) && sectors.length > 0 ? sectors[0] : 'Finance';
    const displayName = `${safeRole} — ${safeSector}`;

    const availabilityNote = [
      jobSearchStatus ? `Job search status: ${jobSearchStatus}.` : '',
      targetComp ? `Target comp: ${targetComp}.` : '',
      workPreference ? `Work preference: ${workPreference}.` : '',
      Array.isArray(preferredCities) && preferredCities.length > 0 ? `Preferred cities: ${preferredCities.join(', ')}.` : '',
    ].filter(Boolean).join(' ');

    const profileDescription = [bio, availabilityNote].filter(Boolean).join('\n\n');

    // ── Core insert payload (columns that definitely exist) ──────────────────
    const corePayload = {
      name: `${firstName} ${lastName}`.trim() || 'Anonymous',
      display_name: displayName,
      email,
      phone: phone || null,
      location: (location || 'United States').trim(),
      experience: expNum,
      education: (education || 'Not specified').trim(),
      highest_education_level: educationLevel || null,
      label: safeRole,
      profile_description: profileDescription || null,
      open_to_opportunities: true,
      resume_full_url: resumeUrl,
      resume_redacted_url: null,
    };

    // ── Extended payload (columns that require migrations) ───────────────────
    const extendedPayload = {
      ...corePayload,
      status: 'active',
      primary_background: primaryBackground || null,
      secondary_backgrounds: Array.isArray(secondaryBackgrounds) ? secondaryBackgrounds : [],
      detailed_experience: Array.isArray(detailedExperience) ? detailedExperience : [],
    };

    // ── Attempt 1: full insert with all columns ───────────────────────────────
    let candidateId: string | null = null;

    const { data: candidate1, error: insertError1 } = await supabase
      .from('candidates')
      .insert(extendedPayload as any)
      .select('id')
      .single();

    if (insertError1) {
      console.error('[submit-candidate] full insert failed:', JSON.stringify(insertError1));

      // ── Attempt 2: core fields only (fallback if migrations not run) ─────────
      const { data: candidate2, error: insertError2 } = await supabase
        .from('candidates')
        .insert(corePayload)
        .select('id')
        .single();

      if (insertError2) {
        console.error('[submit-candidate] core insert also failed:', JSON.stringify(insertError2));
        return res.status(500).json({
          error: 'Failed to save application',
          detail: insertError2.message,
          hint: 'Check required fields: name, display_name, email, location, experience, education, label',
        });
      }

      candidateId = candidate2.id;
      console.log('[submit-candidate] saved with core fields only (migrations pending)');
    } else {
      candidateId = candidate1.id;
    }

    // ── Create Supabase auth account + magic link ────────────────────────────
    let dashboardLink = 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard';
    try {
      // Create auth user (ignore error if already exists)
      await supabase.auth.admin.createUser({ email, email_confirm: true });
      // Generate magic link
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: { redirectTo: 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard' },
      });
      if (linkData?.properties?.action_link) {
        dashboardLink = linkData.properties.action_link;
      }
    } catch (authErr: any) {
      console.warn('[submit-candidate] auth user/link creation failed:', authErr.message);
    }

    // ── Welcome email to candidate ────────────────────────────────────────────
    const welcomeHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
      + '<h2 style="color:#0F6E56">You\'re in! 🎉</h2>'
      + '<p>Hi ' + firstName + ',</p>'
      + '<p>Your profile is live on SFC Talent and visible to recruiters right now. Here\'s what happens next:</p>'
      + '<ul>'
      + '<li>Recruiters can browse your anonymous profile</li>'
      + '<li>When a recruiter requests an introduction, you\'ll get an email</li>'
      + '<li>You have <strong>48 hours to respond</strong> — just reply YES or NO</li>'
      + '</ul>'
      + '<div style="background:#f0faf6;border-left:4px solid #0F6E56;padding:16px;border-radius:4px;margin:24px 0">'
      + '<p style="margin:0;font-weight:600">Manage your profile</p>'
      + '<p style="margin:8px 0 12px;color:#666;font-size:14px">Update your bio, skills, and availability anytime from your candidate dashboard.</p>'
      + '<a href="' + dashboardLink + '" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px">Open My Dashboard →</a>'
      + '<p style="margin:12px 0 0;color:#999;font-size:12px">This link is one-time use. A new link will be emailed each time you sign in.</p>'
      + '</div>'
      + '<p style="color:#666;font-size:14px">Your identity is always protected. We never share your name, contact details, or employer without your explicit consent.</p>'
      + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0">'
      + '<p style="color:#999;font-size:12px">SFC Talent · strategicfinancecareers.com</p>'
      + '</div>';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'SFC Talent <noreply@strategicfinancecareers.com>',
        to: [email],
        subject: 'Welcome to SFC Talent — Your profile is live',
        html: welcomeHtml,
      }),
    }).catch(err => console.warn('[submit-candidate] welcome email failed:', err.message));

    // ── Insert skills ─────────────────────────────────────────────────────────
    if (Array.isArray(skills) && skills.length > 0) {
      for (const skillName of skills) {
        if (!skillName?.trim()) continue;
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

    // ── Send notification email ───────────────────────────────────────────────
    const sectorList = Array.isArray(sectors) && sectors.length > 0 ? sectors.join(', ') : 'Not specified';
    const detailedList = Array.isArray(detailedExperience) && detailedExperience.length > 0 ? detailedExperience.join(', ') : 'Not specified';
    const secondaryList = Array.isArray(secondaryBackgrounds) && secondaryBackgrounds.length > 0 ? secondaryBackgrounds.join(', ') : '—';
    const roleList = Array.isArray(targetRoles) && targetRoles.length > 0 ? targetRoles.join(', ') : 'Not specified';
    const citiesList = Array.isArray(preferredCities) && preferredCities.length > 0 ? preferredCities.join(', ') : '—';

    const emailHtml = '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">'
      + '<h2 style="color:#0F6E56;margin-bottom:4px">New Candidate Application</h2>'
      + '<p style="color:#666;margin-top:0">A new candidate has submitted their profile for review.</p>'
      + '<table style="width:100%;border-collapse:collapse;margin:20px 0">'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;width:38%">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">' + firstName + ' ' + lastName + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + email + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (phone || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">LinkedIn</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (linkedin || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Role</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (currentRole || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Location</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (location || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Experience</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + expNum + ' years</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Education</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (education || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Primary Background</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (primaryBackground || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Secondary</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + secondaryList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Specialisms</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + detailedList + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Job Status</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (jobSearchStatus || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Target Comp</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (targetComp || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Work Preference</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + (workPreference || '—') + '</td></tr>'
      + '<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888">Preferred Cities</td><td style="padding:8px 0;border-bottom:1px solid #eee">' + citiesList + '</td></tr>'
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
        subject: `New Candidate Application: ${firstName} ${lastName} — ${safeRole}`,
        html: emailHtml,
      }),
    });

    return res.status(200).json({ success: true, candidateId });
  } catch (error: any) {
    console.error('[submit-candidate] unhandled error:', error.message, JSON.stringify(error));
    return res.status(500).json({ error: error.message });
  }
}
