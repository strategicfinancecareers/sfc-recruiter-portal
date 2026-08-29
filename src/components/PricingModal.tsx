import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2, Tag, ShieldCheck } from 'lucide-react';
import {
  RECRUITER_AGREEMENT_TITLE,
  RECRUITER_AGREEMENT_VERSION,
  RECRUITER_AGREEMENT_CLAUSES,
} from '@/lib/recruiterAgreement';

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

// Early bird coupon codes (case-insensitive). Displayed pricing only:
// the actual placement fee is invoiced off-platform, so the code a
// recruiter applies here should be recorded with their agreement when
// you invoice. Edit this list to add or retire codes. Exported so the
// StartHere pricing section stays in lockstep with this modal.
export const EARLY_BIRD_CODES = ['EARLYBIRD', 'SFCEARLY'];

export const PLACEMENT_FEE_STANDARD = 15000;
export const PLACEMENT_FEE_EARLY_BIRD = 5000;

export const fmtUsd = (n: number) => `$${n.toLocaleString('en-US')}`;

export default function PricingModal({ open, onOpenChange, userId, userEmail, defaultPlan = 'annual' }: PricingModalProps) {
  const [billing, setBilling] = useState<'monthly' | 'annual'>(defaultPlan);
  const [loading, setLoading] = useState(false);

  // Two-step flow: pick a plan, then agree to the Recruiter Agreement
  // (typed initials) before the Stripe checkout opens.
  const [step, setStep] = useState<'plan' | 'agreement'>('plan');
  const [agreeInitials, setAgreeInitials] = useState('');
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Subscription promo code (3 months free) — validated server-side so
  // the code list never ships in the client bundle.
  const [promoInput, setPromoInput] = useState('');

  // Early bird PLACEMENT FEE coupon state (display only)
  const [couponInput, setCouponInput] = useState('');
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Callers (e.g. StartHere's plan-specific CTAs) change defaultPlan
  // between opens; sync the toggle and reset to the plan step each time
  // the modal opens. Applied coupon state survives reopen.
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

  const handleAgreeAndPay = async () => {
    if (!agreeChecked || !agreeInitials.trim()) return;
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
          initials: agreeInitials.trim(),
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                Payment requires agreeing to the {RECRUITER_AGREEMENT_TITLE}, shown next.
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

              {/* Early bird code entry */}
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
                Version {RECRUITER_AGREEMENT_VERSION}. Please read and initial to continue to payment.
              </p>
            </DialogHeader>

            <div className="border rounded-lg bg-gray-50/60 max-h-72 overflow-y-auto p-4 space-y-3">
              {RECRUITER_AGREEMENT_CLAUSES.map(c => (
                <div key={c.title}>
                  <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{c.body}</p>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-3">
              <div className="w-28">
                <label className="block text-xs text-gray-600 mb-1">Your initials</label>
                <Input
                  value={agreeInitials}
                  onChange={e => setAgreeInitials(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="e.g. JS"
                  className="h-9 text-sm font-semibold tracking-widest text-center"
                />
              </div>
              <label className="flex items-start gap-2 cursor-pointer pb-1 flex-1">
                <input
                  type="checkbox"
                  checked={agreeChecked}
                  onChange={e => setAgreeChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#008037]"
                />
                <span className="text-xs text-gray-600 leading-snug">
                  I have read and agree to the {RECRUITER_AGREEMENT_TITLE}, including the placement fee and communication terms.
                </span>
              </label>
            </div>

            {checkoutError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{checkoutError}</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('plan')} disabled={loading}>
                Back
              </Button>
              <Button
                className="flex-[2] bg-[#008037] hover:bg-[#006a2d]"
                onClick={handleAgreeAndPay}
                disabled={loading || !agreeChecked || !agreeInitials.trim()}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
                ) : 'Agree & continue to payment'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
