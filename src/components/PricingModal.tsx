import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CheckCircle, Loader2, Tag } from 'lucide-react';

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

  // Callers (e.g. StartHere's plan-specific CTAs) change defaultPlan
  // between opens; sync the toggle each time the modal opens. Applied
  // coupon state deliberately survives reopen within the session.
  useEffect(() => {
    if (open) setBilling(defaultPlan);
  }, [open, defaultPlan]);

  // Early bird coupon state
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

  const handleGetStarted = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billing, userId, userEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[PricingModal] no URL in response:', data);
        setLoading(false);
      }
    } catch (err) {
      console.error('[PricingModal] fetch error:', err);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
              {b === 'monthly' ? 'Monthly' : 'Annual (save 40%)'}
            </button>
          ))}
        </div>

        {/* Single plan card */}
        <div className="border-2 border-[#008037] rounded-xl p-5 space-y-3">
          <div>
            <span className="text-4xl font-bold">{billing === 'monthly' ? '$500' : '$300'}</span>
            <span className="text-muted-foreground text-sm">/month</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {billing === 'monthly'
              ? 'Billed monthly. Cancel anytime, effective at the end of the current month.'
              : 'Billed once a year as $3,600. Renews annually. Cancel anytime before renewal.'}
          </p>
          <ul className="space-y-1 pt-1">
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-[#008037] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
          <Button
            className="w-full bg-[#008037] hover:bg-[#006a2d]"
            onClick={handleGetStarted}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</>
            ) : 'Get Started'}
          </Button>
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
      </DialogContent>
    </Dialog>
  );
}
