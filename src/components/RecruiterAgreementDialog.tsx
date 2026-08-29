import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Download } from 'lucide-react';
import RecruiterAgreementContent from './RecruiterAgreementContent';
import { RECRUITER_AGREEMENT_TITLE } from '@/lib/recruiterAgreement';
import { printAgreementDocument, type SignedRecord } from '@/lib/agreementDocument';

// Read-only viewer for the Recruiter Terms and Conditions, so a recruiter
// can pull the agreement up at any time. When a signed record is passed,
// it also offers a download of the signed copy (initials, typed name, and
// date included) through the browser's print dialog.

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Signed record. When acceptedAt is set, the download button appears. */
  record?: SignedRecord;
}

export default function RecruiterAgreementDialog({ open, onOpenChange, record }: Props) {
  const signed = !!record?.acceptedAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="w-5 h-5 text-[#008037]" />
            {RECRUITER_AGREEMENT_TITLE}
          </DialogTitle>
        </DialogHeader>

        {signed && (
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

        <RecruiterAgreementContent mode="view" />

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
