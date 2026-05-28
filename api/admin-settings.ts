import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// /api/admin-settings — admin-only CRUD on the app_settings table.
//
//   GET  ?adminUserId=... [&key=...]
//        without key  → { settings: [...] }  all rows
//        with key     → { setting: { key, value, description } } single row
//
//   PUT  body: { adminUserId, key, value }
//        Upserts the row; sets updated_by + updated_at.
//
// PostgREST is locked down on app_settings (admin-only RLS via the
// migration); we still route through the service role here so we can
// stamp updated_by deterministically and keep the auth check in one
// place.

async function isAdmin(supabase: any, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('users')
    .select('id, is_active, roles ( name )')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return false;
  if ((data as any).is_active === false) return false;
  const roleName = (data as any).roles?.name;
  return roleName === 'admin' || roleName === 'owner';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  if (req.method === 'GET') {
    const adminUserId = req.query.adminUserId as string | undefined;
    const key = req.query.key as string | undefined;
    if (!(await isAdmin(supabase, adminUserId))) {
      console.warn('[admin-settings] GET auth FAIL — adminUserId:', adminUserId);
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (key) {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value, description, updated_at, updated_by')
        .eq('key', key)
        .maybeSingle();
      if (error) {
        console.error('[admin-settings] GET single failed:', JSON.stringify(error));
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ setting: data || null });
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value, description, updated_at, updated_by')
      .order('key');
    if (error) {
      console.error('[admin-settings] GET list failed:', JSON.stringify(error));
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ settings: data || [] });
  }

  if (req.method === 'PUT') {
    const { adminUserId, key, value } = (req.body || {}) as {
      adminUserId?: string; key?: string; value?: unknown;
    };
    if (!(await isAdmin(supabase, adminUserId))) {
      console.warn('[admin-settings] PUT auth FAIL — adminUserId:', adminUserId);
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!key) return res.status(400).json({ error: 'key required' });

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: nowIso, updated_by: adminUserId })
      .eq('key', key);
    if (error) {
      console.error('[admin-settings] PUT failed:', JSON.stringify(error));
      return res.status(500).json({ error: error.message });
    }
    console.log('[admin-settings] updated', key, 'by', adminUserId);
    return res.status(200).json({ success: true, key, updated_at: nowIso });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
