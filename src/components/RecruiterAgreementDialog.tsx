import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Download } from 'lucide-react';
import RecruiterAgreementContent, { type AgreementSignature } from './RecruiterAgreementContent';
import { RECRUITER_AGREEMENT_TITLE, RECRUITER_AGREEMENT_VERSION } from '@/lib/recruiterAgreement';
import { printAgreementDocument, type SignedRecord } from '@/lib/agreementDocument';
import { authedFetch } from '@/integrations/supabase/authedFetch';

// The Recruiter Terms and Conditions, in a dialog. Two uses:
//
//   mode="sign" — Getting Started step 2. Records the signature through
//                 /api/accept-recruiter-agreement (which identifies the
//                 signer from their access token) and calls onSigned.
//   mode="view" — read it back later, with a download of the signed copy.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: 'view' | 'sign';
  /** Signed record. When acceptedAt is set, the download button appears. */
  record?: SignedRecord;
  onSigned?: () => void;
}

export default function RecruiterAgreementDialog({
  open, onOpenChange, mode = 'view', record, onSigned,
}: Props) {
  const signed = !!record?.acceptedAt;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSign = async (sig: AgreementSignature) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await authedFetch('/api/accept-recruiter-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sig, termsVersion: RECRUITER_AGREEMENT_VERSION }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Could not record your signature. Please try again.');
        return;
      }
      onOpenChange(false);
      onSigned?.();
    } catch (err) {
      console.error('[RecruiterAgreementDialog] sign failed:', err);
      setError('Could not record your signature. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[94vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="w-5 h-5 text-[#008037]" />
            {RECRUITER_AGREEMENT_TITLE}
          </DialogTitle>
          {mode === 'sign' && (
            <p className="text-sm text-muted-foreground">
              Two items need your initials, then sign at the bottom.
            </p>
          )}
        </DialogHeader>

        {signed && mode === 'view' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#008037]/25 bg-[#008037]/5 px-4 py-3">
            <p className="text-sm text-[#004a1f]">
              Signed on{' '}
              {new Date(record!.acceptedAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              {record?.signature ? <> by <span className="font-semibold">{record.signature}</span></> : null}.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="border-[#008037]/40 text-[#005a26] hover:bg-[#008037]/10"
              onClick={() => printAgreementDocument(record!)}
            >
              <Download className="w-4 h-4 mr-1.5" />
              Download signed copy
            </Button>
          </div>
        )}

        <RecruiterAgreementContent
          mode={mode}
          onSign={handleSign}
          submitting={submitting}
          error={error}
          submitLabel="Agree and sign"
        />

        {mode === 'view' && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
