import { Navigate } from 'react-router-dom';

// /login is consolidated into /signup (which now hosts the Create
// Account / Sign In tab toggle). This page exists only to redirect
// old bookmarks and any straggling internal callers; the route is
// still registered in App.tsx so /login never 404s.
//
// KNOWN LIMITATION: <Navigate> does NOT preserve the URL hash. Old
// password-reset emails sent before this change point at /login with
// the recovery token in the hash (#access_token=...&type=recovery);
// the hash gets dropped during this client-side redirect. This was
// already broken regardless — no page in the app currently handles
// type=recovery (no supabase.auth.updateUser call, no recovery UI).
// Building real password-recovery support is tracked separately.
//
// The entire previous Login.tsx body (the full sign-in form, the
// testimonial right panel, all the JSX, the useAuth wiring, etc.)
// has been replaced by this single line. Login.tsx is now effectively
// dead code that exists only for the redirect — flagged for full
// removal in a follow-up cleanup pass once we're confident no
// external link or email still points at /login.
const Login = () => <Navigate to="/signup?mode=signin" replace />;

export default Login;
