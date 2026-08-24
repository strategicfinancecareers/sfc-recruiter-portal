import { useEffect, useState } from 'react';
import { Search, Handshake, CalendarCheck, BadgeCheck, ShieldCheck, ArrowRight, Clock, AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PricingModal, { EARLY_BIRD_CODES, PLACEMENT_FEE_STANDARD, PLACEMENT_FEE_EARLY_BIRD, fmtUsd } from '../components/PricingModal';

const howItWorksSteps = [
  {
    icon: Search,
    title: 'Browse Anonymous Talent',
    description: 'Explore our curated pool of pre-screened strategic finance professionals. All profiles are anonymous to protect candidate privacy until an introduction is made.',
  },
  {
    icon: Handshake,
    title: 'Post Your Job & Request an Introduction',
    description: "Before requesting an introduction, you'll need to post the role you're hiring for — including a salary range (required). This helps us match the right candidates and ensures a serious, transparent process.",
  },
  {
    icon: Clock,
    title: 'We Move Fast',
    description: "Expect a response within 24 hours. Once approved, we'll reach out to the candidate on your behalf and confirm their interest.",
  },
  {
    icon: CalendarCheck,
    title: 'Book a Meeting',
    description: "When the candidate is ready, you'll receive a scheduling link to book a call directly. No back and forth, no guesswork.",
  },
  {
    icon: BadgeCheck,
    title: 'Hire with Confidence',
    description: "Every SFC candidate has been vetted through our academy and career program. You're not browsing a database — you're accessing a talent network.",
  },
];

// One plan, two billing options — same features either way. Cancellation
// terms live in the billing copy under the price, not in the feature list.
const PLAN_FEATURES = [
  'Unlimited introduction requests',
  'Candidate responses within 24hrs',
  'Full contact details + resume on acceptance',
  'Priority candidate matching',
  'Dedicated account support',
];

const StartHere = () => {
  const { user } = useAuth();
  const [hasJobs, setHasJobs] = useState<boolean | null>(null);
  const [hasIntros, setHasIntros] = useState<boolean | null>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pricingPlan, setPricingPlan] = useState<'monthly' | 'annual'>('monthly');

  // Pricing-section billing toggle + early bird coupon (mirrors the
  // PricingModal card; constants shared from PricingModal.tsx).
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (EARLY_BIRD_CODES.includes(code)) {
      setCouponApplied(true);
      setCouponError('');
    } else {
      setCouponApplied(false);
      setCouponError('That code is not valid. Check the spelling and try again.');
    }
  };
  const placementFee = couponApplied ? PLACEMENT_FEE_EARLY_BIRD : PLACEMENT_FEE_STANDARD;

  useEffect(() => {
    if (!user?.id) return;

    // Fetch subscription status
    supabase.from('users').select('is_subscribed').eq('id', user.id).single()
      .then(({ data }) => { if (data?.is_subscribed) setIsSubscribed(true); });

    // Fetch job count
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      .then(({ count }) => setHasJobs((count ?? 0) > 0));

    // Intro check must route through service-role API — RLS blocks direct
    // browser queries on introduction_requests for the recruiter role.
    fetch(`/api/recruiter-intros?recruiterId=${encodeURIComponent(user.id)}`)
      .then(r => (r.ok ? r.json() : { requests: [] }))
      .then(({ requests }) => setHasIntros((requests || []).length > 0))
      .catch(err => console.error('[StartHere] intro check failed:', err));
  }, [user?.id]);

  const openPricingModal = (plan: 'monthly' | 'annual') => {
    setPricingPlan(plan);
    setShowPricingModal(true);
  };

  const checklistSteps = [
    {
      label: 'Create Account',
      done: true,
    },
    {
      label: 'Start Membership',
      done: isSubscribed,
      action: !isSubscribed ? (
        <button
          onClick={() => openPricingModal('monthly')}
          className="text-xs font-semibold text-[#006a2d] underline underline-offset-2 hover:text-[#005a26] whitespace-nowrap"
        >
          Subscribe Now →
        </button>
      ) : null,
    },
    {
      label: 'Post Your First Job',
      done: hasJobs === true,
      loading: hasJobs === null,
      action: hasJobs === false ? (
        <Link to="/jobs" className="text-xs font-semibold text-[#006a2d] underline underline-offset-2 hover:text-[#005a26] whitespace-nowrap">
          Post a Job →
        </Link>
      ) : null,
    },
    {
      label: 'Request an Introduction',
      done: hasIntros === true,
      loading: hasIntros === null,
      action: hasIntros === false ? (
        <Link to="/browse" className="text-xs font-semibold text-[#006a2d] underline underline-offset-2 hover:text-[#005a26] whitespace-nowrap">
          Browse Candidates →
        </Link>
      ) : null,
    },
  ];

  const completedCount = checklistSteps.filter(s => s.done).length;

  return (
    <div className="min-h-full bg-white px-6 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-14">
          <span className="inline-block mb-4 px-3 py-1 text-xs font-semibold tracking-wide text-[#006a2d] bg-[#008037]/5 border border-[#008037]/25 rounded-full uppercase">
            Welcome to SFC Talent
          </span>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">
            Find Exceptional Finance Talent, Fast
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            We've built a smarter way to hire. Here's everything you need to know before you start.
          </p>
        </div>

        {/* Onboarding Checklist */}
        <div className="mb-14">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Getting Started</h2>
            <span className="text-sm text-gray-500">{completedCount} of {checklistSteps.length} complete</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full mb-6">
            <div
              className="h-1.5 bg-[#008037] rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / checklistSteps.length) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {checklistSteps.map((step, i) => (
              <div
                key={i}
                className={`flex flex-col gap-2 p-4 rounded-xl border ${step.done ? 'bg-[#008037]/5 border-[#008037]/25' : 'bg-white border-gray-200'}`}
              >
                <div className="flex items-center gap-2">
                  {step.loading ? (
                    <Loader2 className="h-4 w-4 text-gray-400 animate-spin shrink-0" />
                  ) : step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-[#008037] shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                  )}
                  <span className={`text-xs font-medium ${step.done ? 'text-[#006a2d]' : 'text-gray-500'}`}>
                    Step {i + 1}
                  </span>
                </div>
                <p className={`text-sm font-semibold leading-snug ${step.done ? 'text-[#004a1f]' : 'text-gray-700'}`}>
                  {step.label}
                </p>
                {step.action && <div className="mt-auto pt-1">{step.action}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
          {howItWorksSteps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={i}
                className="relative flex flex-col p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#008037]/5 border border-[#008037]/25 text-[#006a2d] text-xs font-bold mb-3">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 text-gray-400 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            );
          })}
        </div>

        {/* Pricing Section */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Simple, Transparent Pricing</h2>
            <p className="text-gray-500">Start browsing for free. Subscribe when you're ready to connect.</p>
          </div>

          {/* Active member banner */}
          {isSubscribed && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-[#008037]/5 border border-[#008037]/25 rounded-xl text-[#005a26] text-sm font-medium">
              <CheckCircle2 className="h-5 w-5 text-[#008037] shrink-0" />
              You're an active SFC Talent member. Your introduction requests are unlimited.
            </div>
          )}

          <div className="max-w-xl mx-auto space-y-4">
            {/* Billing toggle */}
            <div className="grid grid-cols-2 rounded-lg border border-gray-200 p-1 bg-gray-50">
              {(['monthly', 'annual'] as const).map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBilling(b)}
                  className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                    billing === b
                      ? 'bg-white shadow-sm text-[#004a1f] border border-[#008037]/30'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {b === 'monthly' ? 'Monthly' : 'Annual (save 40%)'}
                </button>
              ))}
            </div>

            {/* Single plan card */}
            <div className="border-2 border-[#008037] rounded-xl p-6 space-y-4 bg-white">
              <div>
                <span className="text-4xl font-bold text-gray-900">{billing === 'monthly' ? '$500' : '$300'}</span>
                <span className="text-gray-500 text-sm">/month</span>
              </div>
              <p className="text-sm text-gray-500">
                {billing === 'monthly'
                  ? 'Billed monthly. Cancel anytime, effective at the end of the current month.'
                  : 'Billed once a year as $3,600. Renews annually. Cancel anytime before renewal.'}
              </p>
              <ul className="space-y-2">
                {PLAN_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                    <CheckCircle2 className="h-4 w-4 text-[#008037] mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {isSubscribed ? (
                <div className="flex items-center gap-2 text-sm font-semibold text-[#006a2d]">
                  <CheckCircle2 className="h-4 w-4" /> Your Current Plan
                </div>
              ) : (
                <button
                  onClick={() => openPricingModal(billing)}
                  className="w-full py-2.5 rounded-lg bg-[#008037] hover:bg-[#006a2d] text-white font-semibold text-sm transition-colors"
                >
                  Get Started
                </button>
              )}
            </div>

            {/* Placement fee: clear and upfront, never a footnote */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Placement fee</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Due only when you successfully hire an SFC candidate.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-gray-900">{fmtUsd(placementFee)}</p>
                  {couponApplied ? (
                    <span className="inline-block bg-[#008037] text-white text-[10px] font-semibold rounded-full px-2 py-0.5 mt-0.5">
                      Early bird applied
                    </span>
                  ) : (
                    <p className="text-[10px] text-gray-400">per placement</p>
                  )}
                </div>
              </div>

              {!couponApplied ? (
                <div>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value); setCouponError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                      placeholder="Early bird code"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#008037] focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={!couponInput.trim()}
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-xs text-red-600 mt-1.5">{couponError}</p>}
                </div>
              ) : (
                <p className="text-xs text-[#006a2d]">
                  Early bird rate locked in: {fmtUsd(PLACEMENT_FEE_EARLY_BIRD)} per placement instead of {fmtUsd(PLACEMENT_FEE_STANDARD)}.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Job Posting Requirement Box */}
        <div className="flex items-start gap-4 p-6 bg-amber-50 border border-amber-200 rounded-xl mb-4">
          <AlertCircle className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Before You Request an Introduction</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              You must have an active job posting to request a candidate introduction. Salary range is required — candidates value transparency, and it helps us find the right match faster.
            </p>
          </div>
        </div>

        {/* Privacy Info Box */}
        <div className="flex items-start gap-4 p-6 bg-[#008037]/5 border border-[#008037]/25 rounded-xl mb-12">
          <ShieldCheck className="h-6 w-6 text-[#008037] flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Privacy First</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Candidate identities are never revealed without mutual consent. Real names, contact details, and employers are only shared after an introduction is approved by our team.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-base text-gray-500 mb-4">Ready to find your next hire?</p>
          <Link
            to="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#008037] hover:bg-[#006a2d] text-white text-sm font-semibold rounded-lg transition-colors duration-200"
          >
            Browse Candidates
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

      </div>

      <PricingModal
        open={showPricingModal}
        onOpenChange={setShowPricingModal}
        userId={user?.id}
        userEmail={user?.email}
        defaultPlan={pricingPlan}
      />
    </div>
  );
};

export default StartHere;
