// Edge function to create/link an admin user and upsert into public.users
// Uses SERVICE_ROLE to invite (or find) the auth user and set admin role with notify_intro_requests=false

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
    // Authenticated client with caller's JWT (for admin checks when needed)
    const supabaseAuthed = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const body = await req.json().catch(() => ({}));
    const {
      email,
      first_name,
      last_name,
      role = 'admin',
      notify_intro_requests = false,
    }: {
      email: string;
      first_name: string;
      last_name: string;
      role?: 'admin' | 'recruiter' | 'owner';
      notify_intro_requests?: boolean;
    } = body;

    if (!email || !first_name || !last_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, first_name, last_name' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Fetch role id for requested role (default admin)
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from('roles')
      .select('id, name')
      .eq('name', role)
      .single();

    if (roleErr || !roleRow) {
      console.error('Role fetch error', roleErr);
      return new Response(JSON.stringify({ error: 'Role not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const adminRoleId = (await supabaseAdmin.from('roles').select('id').eq('name', 'admin').single()).data?.id;
    const ownerRoleId = (await supabaseAdmin.from('roles').select('id').eq('name', 'owner').single()).data?.id;

    // Count existing elevated users (admin or owner) to allow bootstrap if none exist
    let elevatedCount = 0;
    if (adminRoleId || ownerRoleId) {
      const { count, error: countErr } = await supabaseAdmin
        .from('users')
        .select('id', { count: 'exact', head: true })
        .in('role_id', [adminRoleId, ownerRoleId].filter(Boolean) as string[]);
      if (countErr) {
        console.error('Elevated count error', countErr);
      } else if (typeof count === 'number') {
        elevatedCount = count;
      }
    }


    // If elevated users exist, require caller to be admin or owner
    if (elevatedCount > 0) {
      const { data: userRes, error: getUserErr } = await supabaseAuthed.auth.getUser();
      if (getUserErr || !userRes?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Verify caller is admin or owner
      const { data: callerRow, error: callerErr } = await supabaseAdmin
        .from('users')
        .select('role_id')
        .eq('id', userRes.user.id)
        .single();

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
    }

    // Try to find existing auth user by email
    let authUserId: string | null = null;

    // Paginate through users (first page sufficient for one-off admin creation)
    const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      console.error('listUsers error', listErr);
    }
    const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      authUserId = existing.id;
      console.log('Found existing auth user', authUserId);
    } else {
      // Invite user by email (sends invite and creates auth user)
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name,
          last_name,
          full_name: `${first_name} ${last_name}`,
        },
      });
      if (inviteErr) {
        console.error('inviteUserByEmail error', inviteErr);
        return new Response(JSON.stringify({ error: inviteErr.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      authUserId = inviteData?.user?.id ?? null;
      console.log('Invited new auth user', authUserId);
    }

    if (!authUserId) {
      return new Response(JSON.stringify({ error: 'Failed to find or create auth user' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Upsert into public.users
    const { error: upsertErr } = await supabaseAdmin.from('users').upsert(
      {
        id: authUserId,
        email,
        first_name,
        last_name,
        role_id: roleRow.id,
        notify_intro_requests,
        is_active: true,
        has_accepted_terms: false,
      },
      { onConflict: 'id' }
    );

    if (upsertErr) {
      console.error('users upsert error', upsertErr);
      return new Response(JSON.stringify({ error: upsertErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({ success: true, auth_user_id: authUserId, role_assigned: roleRow.id }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  } catch (e) {
    console.error('Unhandled error', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
