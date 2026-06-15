import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Loader2 } from 'lucide-react';

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
  'Résumé PDF delivered on acceptance',
  'Dedicated SFC support',
];

export default function PricingModal({ open, onOpenChange, userId, userEmail }: PricingModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<'monthly' | 'annual' | null>(null);

  const handleGetStarted = async (plan: 'monthly' | 'annual') => {
    setLoadingPlan(plan);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, userId, userEmail }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[PricingModal] no URL in response:', data);
        setLoadingPlan(null);
      }
    } catch (err) {
      console.error('[PricingModal] fetch error:', err);
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-heading text-center">
            Unlock Introduction Requests
          </DialogTitle>
          <p className="text-center text-muted-foreground mt-1">
            Connect with pre-screened strategic finance talent
          </p>
        </DialogHeader>

        {/* Feature list */}
        <ul className="space-y-1 my-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-[#008037] shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* Plan cards */}
        <div className="grid grid-cols-2 gap-4 mt-2">
          {/* Monthly */}
          <div className="border rounded-xl p-5 flex flex-col gap-3">
            <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Monthly</div>
            <div>
              <span className="text-3xl font-bold">$500</span>
              <span className="text-muted-foreground text-sm">/mo</span>
            </div>
            <div className="text-xs text-muted-foreground">Billed monthly</div>
            <Button
              className="w-full mt-auto bg-[#008037] hover:bg-[#0a5a45]"
              onClick={() => handleGetStarted('monthly')}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === 'monthly' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</>
              ) : 'Get Started'}
            </Button>
          </div>

          {/* Annual — highlighted */}
          <div className="border-2 border-[#008037] rounded-xl p-5 flex flex-col gap-3 relative">
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#008037] text-white text-xs px-3 py-0.5 whitespace-nowrap">
              Best Value
            </Badge>
            <div className="text-sm font-semibold text-[#008037] uppercase tracking-wide">Annual</div>
            <div>
              <span className="text-3xl font-bold">$300</span>
              <span className="text-muted-foreground text-sm">/mo</span>
            </div>
            <div className="text-xs text-muted-foreground">Billed annually · Save $2,400/year</div>
            <Button
              className="w-full mt-auto bg-[#008037] hover:bg-[#0a5a45]"
              onClick={() => handleGetStarted('annual')}
              disabled={loadingPlan !== null}
            >
              {loadingPlan === 'annual' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…</>
              ) : 'Get Started'}
            </Button>
          </div>
        </div>

        {/* Success fee note */}
        <p className="text-xs text-muted-foreground text-center mt-1">
          * Plus 5% of candidate starting salary upon successful placement, including signing bonus.
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Cancel anytime. No long-term commitment on monthly plan.
        </p>
      </DialogContent>
    </Dialog>
  );
}
