import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);
const resend = new Resend(process.env.RESEND_API_KEY);

const DASHBOARD_URL = 'https://sfc-recruiter-portal.vercel.app/candidate-dashboard';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  try {
    // Fetch candidate — check if welcome already sent
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select('id, name, email, dashboard_welcome_sent')
      .eq('email', email.toLowerCase().trim())
      .or('status.eq.active,status.is.null')
      .maybeSingle();

    if (candErr) {
      console.error('[send-candidate-welcome] lookup error:', candErr.message);
      return res.status(500).json({ error: candErr.message });
    }
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

    // Idempotent — only send once
    if (candidate.dashboard_welcome_sent) {
      return res.status(200).json({ skipped: true, reason: 'already sent' });
    }

    const firstName = candidate.name?.split(' ')[0] || 'there';

    const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
  <img src="https://sfc-recruiter-portal.vercel.app/logo.png" height="40" style="margin-bottom:24px" />
  <h2 style="color:#0F6E56;margin-bottom:4px">Welcome to your dashboard 🎉</h2>
  <p>Hi ${firstName},</p>
  <p>You're now signed in to your SFC Talent candidate dashboard. Here's what you can do:</p>
  <ul style="padding-left:20px;line-height:1.8;color:#374151">
    <li>See exactly how recruiters view your profile</li>
    <li>Update your availability, bio, and preferences</li>
    <li>Track introduction requests and respond directly</li>
  </ul>
  <div style="margin:28px 0">
    <a href="${DASHBOARD_URL}" style="display:inline-block;background:#0F6E56;color:white;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
      Open My Dashboard →
    </a>
  </div>
  <p style="color:#6B7280;font-size:14px">
    Your identity stays fully protected — recruiters only see your anonymous profile until you choose to connect.
  </p>
  <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0" />
  <p style="color:#9CA3AF;font-size:12px">SFC Talent · strategicfinancecareers.com</p>
</div>`;

    const { error: emailErr } = await resend.emails.send({
      from: 'SFC Talent <noreply@strategicfinancecareers.com>',
      to: candidate.email,
      subject: 'Welcome to your SFC Talent dashboard',
      html,
    });

    if (emailErr) {
      console.error('[send-candidate-welcome] resend error:', emailErr);
      return res.status(500).json({ error: 'Email failed' });
    }

    // Mark as sent — ignore error if column doesn't exist yet
    await (supabase as any)
      .from('candidates')
      .update({ dashboard_welcome_sent: true })
      .eq('id', candidate.id);

    console.log('[send-candidate-welcome] sent to:', candidate.email);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[send-candidate-welcome] unhandled:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
