// Edge function to list users with verification and login status
// Admin/Owner only
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticated client with caller's JWT
    const supabaseAuthed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    // Identify caller
    const { data: userRes, error: getUserErr } = await supabaseAuthed.auth.getUser();
    if (getUserErr || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get role ids
    const [adminRole, ownerRole] = await Promise.all([
      supabaseAdmin.from('roles').select('id').eq('name', 'admin').maybeSingle(),
      supabaseAdmin.from('roles').select('id').eq('name', 'owner').maybeSingle(),
    ]);

    const adminRoleId = adminRole.data?.id;
    const ownerRoleId = ownerRole.data?.id;

    // Confirm caller is admin or owner
    const { data: callerRow, error: callerErr } = await supabaseAdmin
      .from('users')
      .select('role_id')
      .eq('id', userRes.user.id)
      .maybeSingle();

    if (
      callerErr ||
      !callerRow ||
      (callerRow.role_id !== adminRoleId && callerRow.role_id !== ownerRoleId)
    ) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin or owner only' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Fetch roles to map id -> name
    const { data: roles, error: rolesErr } = await supabaseAdmin.from('roles').select('id, name');
    if (rolesErr) throw rolesErr;
    const roleMap = new Map<string, string>((roles || []).map((r) => [r.id, r.name]));

    // Fetch app users (public.users)
    const { data: appUsers, error: usersErr } = await supabaseAdmin
      .from('users')
      .select('id, email, first_name, last_name, role_id, is_active, has_accepted_terms, created_at, updated_at, notify_intro_requests');

    if (usersErr) throw usersErr;

    // Fetch auth users and map by id
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;

    const confirmMap = new Map<string, string | null>();
    for (const u of listData?.users ?? []) {
      // email_confirmed_at can be string | null
      // deno types may consider it as string | null | undefined, coerce to null when missing
      // @ts-ignore - runtime safety
      confirmMap.set(u.id, u.email_confirmed_at ?? null);
    }

    const merged = (appUsers || []).map((u) => {
      const email_confirmed_at = confirmMap.get(u.id) ?? null;
      const able_to_login = (u.is_active !== false) && !!email_confirmed_at;
      return {
        ...u,
        role: roleMap.get(u.role_id) ?? 'unknown',
        email_confirmed_at,
        able_to_login,
      };
    });

    return new Response(
      JSON.stringify({ users: merged }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('Unhandled error (list-users-status)', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
