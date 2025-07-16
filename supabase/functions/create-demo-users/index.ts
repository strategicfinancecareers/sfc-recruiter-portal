import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get role IDs
    const { data: roles } = await supabaseAdmin
      .from('roles')
      .select('id, name')
    
    const adminRoleId = roles?.find(r => r.name === 'admin')?.id
    const recruiterRoleId = roles?.find(r => r.name === 'recruiter')?.id

    if (!adminRoleId || !recruiterRoleId) {
      throw new Error('Required roles not found')
    }

    // Create demo admin user
    const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@demo.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        first_name: 'Demo',
        last_name: 'Admin'
      }
    })

    if (adminError) {
      console.error('Error creating admin user:', adminError)
    } else {
      // Create admin profile
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: adminUser.user.id,
          email: 'admin@demo.com',
          first_name: 'Demo',
          last_name: 'Admin',
          role_id: adminRoleId,
          has_accepted_terms: true
        })
    }

    // Create demo recruiter user
    const { data: recruiterUser, error: recruiterError } = await supabaseAdmin.auth.admin.createUser({
      email: 'recruiter@demo.com',
      password: 'recruiter123',
      email_confirm: true,
      user_metadata: {
        first_name: 'Demo',
        last_name: 'Recruiter'
      }
    })

    if (recruiterError) {
      console.error('Error creating recruiter user:', recruiterError)
    } else {
      // Create recruiter profile
      await supabaseAdmin
        .from('profiles')
        .upsert({
          id: recruiterUser.user.id,
          email: 'recruiter@demo.com',
          first_name: 'Demo',
          last_name: 'Recruiter',
          role_id: recruiterRoleId,
          has_accepted_terms: true
        })
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        adminCreated: !adminError,
        recruiterCreated: !recruiterError,
        errors: { adminError, recruiterError }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})