import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoaderScreen from '../components/LoaderScreen';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  const { login, isLoading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const dest = (user as any).is_subscribed ? '/browse' : '/start-here';
      navigate(dest, { replace: true });
    }
  }, [user, navigate]);

  if (isLoading) return <LoaderScreen />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalLoading(true);
    try {
      await login(email, password);
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — form ── */}
      <div className="w-full lg:w-[420px] xl:w-[480px] flex flex-col bg-[#f8f8f8] px-10 py-12 shrink-0">
        {/* Logo */}
        <div className="mb-10">
          <span className="font-bold text-lg text-gray-900 tracking-tight">SFC Talent</span>
        </div>

        <div className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto lg:mx-0">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to your recruiter account</p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={localLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors mt-1"
            >
              {localLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="flex items-center justify-between mt-5 text-sm">
            <Link to="/forgot-password" className="text-gray-400 hover:text-gray-600 hover:underline text-xs">
              Forgot password?
            </Link>
            <p className="text-gray-500">
              No account?{' '}
              <Link to="/signup" className="text-emerald-600 hover:underline font-medium">Sign up</Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 mt-10 leading-relaxed max-w-sm mx-auto lg:mx-0">
          By continuing, you agree to SFC Talent's{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Terms of Service</a>
          {' '}and{' '}
          <a href="https://strategicfinancecareers.com" className="underline hover:text-gray-600">Privacy Policy</a>.
        </p>
      </div>

      {/* ── Right panel — testimonial ── */}
      <div className="hidden lg:flex flex-1 bg-white items-center justify-center px-16">
        <div className="max-w-md">
          <div className="text-gray-200 text-6xl font-serif leading-none mb-6 select-none">"</div>
          <blockquote className="text-2xl font-medium text-gray-900 leading-snug mb-6">
            Found our CFO in under two weeks. The quality of candidates in the SFC network is genuinely different.
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
              SK
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Sarah K.</p>
              <p className="text-xs text-gray-400">CEO, growth-stage fintech</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
