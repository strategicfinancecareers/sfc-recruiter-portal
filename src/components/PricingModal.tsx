import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, Check, Tag, ShieldCheck } from 'lucide-react';
import RecruiterAgreementContent, { type AgreementSignature } from './RecruiterAgreementContent';
import { RECRUITER_AGREEMENT_TITLE, RECRUITER_AGREEMENT_VERSION } from '@/lib/recruiterAgreement';

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  userEmail?: string;
  defaultPlan?: 'monthly' | 'annual';
}

const FEATURES = [
  'Unlimited candidate browsing',
  'Send introduction requests',
  'Candidate email & phone details on match',
  'Resume PDF delivered on acceptance',
  'Dedicated SFC support',
];

// Early bird coupon codes (case-insensitive) for the PLACEMENT FEE display.
// Display pricing only: the fee itself is invoiced off-platform, so record
// which code a recruiter used when you invoice. Edit to add or retire codes.
// Exported so the StartHere pricing section stays in lockstep.
export const EARLY_BIRD_CODES = ['EARLYBIRD', 'SFCEARLY'];

export const PLACEMENT_FEE_STANDARD = 15000;
export const PLACEMENT_FEE_EARLY_BIRD = 5000;

export const fmtUsd = (n: number) => `$${n.toLocaleString('en-US')}`;

// Three-step progress header so "agree to the terms" reads as its own
// deliberate step rather than an interstitial before payment.
function Stepper({ step }: { step: 'plan' | 'agreement' }) {
  const steps = [
    { key: 'plan', label: 'Choose plan' },
    { key: 'agreement', label: 'Agree to terms' },
    { key: 'payment', label: 'Payment' },
  ] as const;
  const activeIndex = step === 'plan' ? 0 : 1;

  return (
    <div className="flex items-center gap-2 pb-1">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={s.key} className="flex items-center gap-2 min-w-0">
            <div
              className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
                done ? 'bg-[#008037] text-white'
                  : active ? 'bg-[#008037] text-white ring-4 ring-[#008037]/15'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap ${active ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>
              {s.label}
            </span>
            {i < steps.length - 1 && <div className="w-6 sm:w-10 h-px bg-gray-200 mx-1" />}
          </div>
        );
      })}
    </div>
  );
}

export default function PricingModal({ open, onOpenChange, userId, userEmail, defaultPlan = 'annual' }: PricingModalProps) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>(defaultPlan);
  const [loading, setLoading] = useState(false);

  // Two steps: pick a plan, then read + sign the Recruiter Agreement
  // (initials on the fee and communications clauses, typed name at the
  // bottom) before Stripe opens.
  const [step, setStep] = useState<'plan' | 'agreement'>('plan');
  const [checkoutError, setCheckoutError] = useState('');

  // Subscription promo code (3 months free) — validated server-side so the
  // code list never ships in the client bundle.
  const [promoInput, setPromoInput] = useState('');

  // Early bird PLACEMENT FEE coupon (display only)
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    if (open) {
      setBilling(defaultPlan);
      setStep('plan');
      setCheckoutError('');
    }
  }, [open, defaultPlan]);

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

  const handleSign = async (sig: AgreementSignature) => {
    setLoading(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: billing,
          userId,
          userEmail,
          initialsFee: sig.initialsFee,
          initialsComms: sig.initialsComms,
          signature: sig.signature,
          termsVersion: RECRUITER_AGREEMENT_VERSION,
          promoCode: promoInput.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCheckoutError(data.error || 'Could not start checkout. Please try again.');
        if (data.invalidPromo) setStep('plan');
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[PricingModal] no URL in response:', data);
        setCheckoutError('Could not start checkout. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('[PricingModal] fetch error:', err);
      setCheckoutError('Could not start checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={step === 'plan' ? 'max-w-md max-h-[92vh] overflow-y-auto' : 'max-w-4xl max-h-[92vh] overflow-y-auto'}>
        <Stepper step={step} />
        {step === 'plan' ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold font-heading text-center">
                Unlock Introduction Requests
              </DialogTitle>
              <p className="text-center text-muted-foreground mt-1">
                Connect with pre-screened strategic finance talent
              </p>
            </DialogHeader>

            {/* Billing toggle */}
            <div className="grid grid-cols-2 rounded-lg border p-1 bg-gray-50">
              {(['monthly', 'annual'] as const).map(b => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBilling(b)}
                  className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                    billing === b ? 'bg-white shadow-sm text-[#004a1f] border border-[#008037]/30' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {b === 'monthly' ? 'Monthly' : 'Annual (save 33%)'}
                </button>
              ))}
            </div>

            {/* Single plan card */}
            <div className="border-2 border-[#008037] rounded-xl p-5 space-y-3">
              <div>
                <span className="text-4xl font-bold">{billing === 'monthly' ? '$150' : '$100'}</span>
                <span className="text-muted-foreground text-sm">/month</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {billing === 'monthly'
                  ? 'Billed monthly. Cancel anytime, effective at the end of the current month.'
                  : 'Billed once a year as $1,200. Renews annually. Cancel anytime before renewal.'}
              </p>
              <ul className="space-y-1 pt-1">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-[#008037] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {/* Subscription promo code (3 months free) */}
              <div>
                <Input
                  value={promoInput}
                  onChange={e => { setPromoInput(e.target.value); setCheckoutError(''); }}
                  placeholder="Promo code (optional)"
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  A valid promo code gives you the first 3 months free. Validated at checkout.
                </p>
              </div>

              {checkoutError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{checkoutError}</p>
              )}

              <Button
                className="w-full bg-[#008037] hover:bg-[#006a2d]"
                onClick={() => { setCheckoutError(''); setStep('agreement'); }}
              >
                Get Started
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Next: review and sign the recruiter terms. Then payment.
              </p>
            </div>

            {/* Placement fee: clear and upfront, never a footnote */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Placement fee</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Due only when you successfully hire an SFC candidate.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-gray-900">{fmtUsd(placementFee)}</p>
                  {couponApplied ? (
                    <Badge className="bg-[#008037] text-white text-[10px] mt-0.5">Early bird applied</Badge>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">per placement</p>
                  )}
                </div>
              </div>

              {!couponApplied && (
                <div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                      <Input
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value); setCouponError(''); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                        placeholder="Early bird code"
                        className="pl-8 h-9 text-sm bg-white"
                      />
                    </div>
                    <Button type="button" variant="outline" className="h-9" onClick={applyCoupon} disabled={!couponInput.trim()}>
                      Apply
                    </Button>
                  </div>
                  {couponError && <p className="text-xs text-red-600 mt-1.5">{couponError}</p>}
                </div>
              )}
              {couponApplied && (
                <p className="text-xs text-[#006a2d]">
                  Early bird rate locked in: {fmtUsd(PLACEMENT_FEE_EARLY_BIRD)} per placement instead of {fmtUsd(PLACEMENT_FEE_STANDARD)}.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-heading flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#008037]" />
                {RECRUITER_AGREEMENT_TITLE}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Two items need your initials, then sign at the bottom to continue to payment.
              </p>
            </DialogHeader>

            <RecruiterAgreementContent
              mode="sign"
              onSign={handleSign}
              onBack={() => setStep('plan')}
              submitting={loading}
              error={checkoutError}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
