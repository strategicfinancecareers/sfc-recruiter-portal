import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore — ESM JS helper, no .d.ts file
import { requireAdmin } from './_shared/requireAuth.js';

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

async function callerIsAdmin(req: VercelRequest, supabase: any): Promise<{ ok: boolean; userId?: string }> {
  const caller = await requireAdmin(req, supabase);
  if ((caller as any).error) return { ok: false };
  return { ok: true, userId: (caller as any).userId };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );

  if (req.method === 'GET') {
    const key = req.query.key as string | undefined;
    const auth = await callerIsAdmin(req, supabase);
    if (!auth.ok) {
      console.warn('[admin-settings] GET auth FAIL');
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
    const { key, value } = (req.body || {}) as {
      key?: string; value?: unknown;
    };
    const auth = await callerIsAdmin(req, supabase);
    if (!auth.ok) {
      console.warn('[admin-settings] PUT auth FAIL');
      return res.status(403).json({ error: 'Forbidden' });
    }
    const adminUserId = auth.userId;
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
