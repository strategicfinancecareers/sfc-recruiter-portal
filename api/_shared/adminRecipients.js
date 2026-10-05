// Admin notification fan-out.
//
// The "new candidate", "new recruiter", and "profile updated" alerts used
// to go to a single hardcoded inbox, which meant any admin who did not
// watch that inbox (tester feedback: Soomin) had to poll the admin
// dashboard to catch new signups. Alerts now go to the shared inbox PLUS
// every active admin/owner account, resolved live from the users table,
// so adding or deactivating an admin automatically updates who gets
// notified with no code change.
//
// Always returns at least the shared inbox, even if the role query
// fails — losing an alert is worse than double-sending one.

const SHARED_INBOX = 'team@strategicfinancecareers.com';

export async function getAdminNotifyRecipients(supabase) {
  const recipients = new Set([SHARED_INBOX]);
  try {
    const { data, error } = await supabase
      .from('users')
      .select('email, is_active, roles ( name )');
    if (error) {
      console.warn('[adminRecipients] role query failed, using shared inbox only:', error.message);
      return [...recipients];
    }
    for (const u of data || []) {
      const role = u?.roles?.name;
      if ((role === 'admin' || role === 'owner') && u.is_active !== false && u.email) {
        recipients.add(u.email.toLowerCase());
      }
    }
  } catch (err) {
    console.warn('[adminRecipients] threw, using shared inbox only:', err?.message);
  }
  return [...recipients];
}
