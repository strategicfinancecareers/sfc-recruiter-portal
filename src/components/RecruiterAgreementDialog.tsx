import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import RecruiterAgreementContent from './RecruiterAgreementContent';
import { RECRUITER_AGREEMENT_TITLE, RECRUITER_AGREEMENT_VERSION } from '@/lib/recruiterAgreement';

// Read-only viewer for the Recruiter Terms and Conditions, so a recruiter
// can pull the agreement up at any time after signing (Account page,
// pricing section, intro-request confirmation). The signing flow lives in
// PricingModal, which renders RecruiterAgreementContent in 'sign' mode.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional acceptance record shown at the top ("You accepted this on…"). */
  acceptedAt?: string | null;
  signature?: string | null;
}

export default function RecruiterAgreementDialog({ open, onOpenChange, acceptedAt, signature }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#008037]" />
            {RECRUITER_AGREEMENT_TITLE}
          </DialogTitle>
        </DialogHeader>

        {acceptedAt && (
          <div className="rounded-lg border border-[#008037]/25 bg-[#008037]/5 px-3 py-2.5 text-xs text-[#004a1f]">
            Accepted on {new Date(acceptedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {signature ? <> by <span className="font-semibold">{signature}</span></> : null}
            {' '}(version {RECRUITER_AGREEMENT_VERSION}).
          </div>
        )}

        <RecruiterAgreementContent mode="view" />

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
