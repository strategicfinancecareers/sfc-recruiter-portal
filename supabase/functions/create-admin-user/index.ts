import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface CreateAdminBody {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticated client with caller's JWT (to check admin)
    const authHeader = req.headers.get("Authorization") || "";
    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for privileged ops
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { email, password, first_name, last_name }: CreateAdminBody = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Ensure caller is admin
    const { data: isAdmin, error: adminCheckErr } = await authedClient.rpc("is_current_user_admin");
    if (adminCheckErr) {
      console.error("Admin check error", adminCheckErr);
      return new Response(JSON.stringify({ error: "Admin check failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // If user already exists in users table by email, just update role to admin
    const { data: existingUser } = await adminClient
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // Resolve admin role id
    const { data: roleRow, error: roleErr } = await adminClient
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

    let userId: string | null = existingUser?.id ?? null;

    if (!userId) {
      // Create auth user (this will trigger handle_new_user to insert into public.users with recruiter role)
      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name, last_name, full_name: [first_name, last_name].filter(Boolean).join(" ") },
      });
      if (createErr || !created?.user) {
        console.error("Auth create error", createErr);
        return new Response(JSON.stringify({ error: createErr?.message || "Failed to create auth user" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      userId = created.user.id;
    }

    // Promote to admin in public.users
    const { error: updErr } = await adminClient
      .from("users")
      .update({ role_id: roleRow.id, is_active: true })
      .eq("id", userId!);
    if (updErr) {
      console.error("Promote error", updErr);
      return new Response(JSON.stringify({ error: "Failed to assign admin role" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: userId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("create-admin-user error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
