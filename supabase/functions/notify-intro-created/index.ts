import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const resend = new Resend(resendApiKey);
const supabase = createClient(supabaseUrl!, serviceRoleKey!);

interface InvokeBody {
  request_id: string;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY secret");
      return new Response(JSON.stringify({ error: "Email service misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase service credentials");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { request_id }: InvokeBody = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("notify-intro-created invoked for:", request_id);

    // Fetch intro request
    const { data: intro, error: introErr } = await supabase
      .from("introduction_requests")
      .select("id, requester_id, candidate_id, job_id, created_at")
      .eq("id", request_id)
      .single();
    if (introErr || !intro) {
      console.error("Intro fetch error", introErr);
      return new Response(JSON.stringify({ error: "Introduction request not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch details
    const [{ data: requester }, { data: candidate }, { data: job }] = await Promise.all([
      supabase.from("users").select("first_name,last_name,email").eq("id", intro.requester_id).single(),
      supabase.from("candidates").select("display_name").eq("id", intro.candidate_id).single(),
      intro.job_id
        ? supabase.from("jobs").select("title,company").eq("id", intro.job_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    // Resolve admin role id
    const { data: roleRow, error: roleErr } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "admin")
      .single();
    if (roleErr || !roleRow) {
      console.error("Role fetch error", roleErr);
      return new Response(JSON.stringify({ error: "Admin role not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch opted-in admins
    const { data: admins, error: adminErr } = await supabase
      .from("users")
      .select("email, first_name, last_name")
      .eq("role_id", roleRow.id)
      .eq("is_active", true)
      .eq("notify_intro_requests", true);

    if (adminErr) {
      console.error("Admins fetch error", adminErr);
      return new Response(JSON.stringify({ error: "Failed to fetch admins" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const recipients = (admins || []).map((a) => a.email).filter(Boolean);
    if (recipients.length === 0) {
      console.log("No opted-in admins to notify");
      return new Response(JSON.stringify({ ok: true, notified: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const requesterName = `${requester?.first_name ?? ''} ${requester?.last_name ?? ''}`.trim() || "Recruiter";
    const jobLine = job ? `${job.title} at ${job.company}` : "(No job specified)";

    const subject = `New introduction request from ${requesterName}`;
    const createdAt = new Date(intro.created_at).toLocaleString();

    const html = `
      <div style="font-family: Inter, ui-sans-serif, system-ui;">
        <h2 style="margin:0 0 12px 0;">New Introduction Request</h2>
        <p style="margin:0 0 4px 0;"><strong>Requester:</strong> ${requesterName} (${requester?.email ?? 'N/A'})</p>
        <p style="margin:0 0 4px 0;"><strong>Candidate:</strong> ${candidate?.display_name ?? 'N/A'}</p>
        <p style="margin:0 0 4px 0;"><strong>Job:</strong> ${jobLine}</p>
        <p style="margin:0 0 12px 0;"><strong>Requested:</strong> ${createdAt}</p>
        <p style="margin:16px 0 0 0;">View in Admin: /introductions</p>
      </div>
    `;

    // Send one email per admin to avoid exposing recipient list
    let sent = 0;
    for (const to of recipients) {
      try {
        const res = await resend.emails.send({
          from: "Lovable <notifications@resend.dev>",
          to: [to],
          subject,
          html,
        });
        if (res) sent += 1;
      } catch (e) {
        console.error("Resend send error for", to, e);
      }
    }

    console.log(`Notification emails sent: ${sent}/${recipients.length}`);

    return new Response(JSON.stringify({ ok: true, notified: sent }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("notify-intro-created error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
