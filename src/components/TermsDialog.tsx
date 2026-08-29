import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { KEY_CLAUSES, RECRUITER_AGREEMENT_TITLE } from "@/lib/recruiterAgreement";

// Shown before a recruiter's first introduction request. This is a
// REMINDER of the two obligations that attach the moment an introduction
// happens, not a separate set of terms.
//
// It previously stated its own commercial terms ("20% of first-year
// salary", "90-day replacement guarantee", "payment due within 30 days"),
// which contradicted the signed Recruiter Agreement. All commercial terms
// now come from src/lib/recruiterAgreement.ts so there is exactly one
// source of truth; the full text lives on the Account page.

interface TermsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept?: () => void;
}

const TermsDialog: React.FC<TermsDialogProps> = ({ open, onOpenChange, onAccept }) => {
  const [accepted, setAccepted] = useState(false);
  const { acceptTerms } = useAuth();
  const { toast } = useToast();

  const handleAccept = () => {
    if (!accepted) return;
    acceptTerms();
    onOpenChange(false);
    toast({
      title: "Confirmed",
      description: "You can now request introductions to candidates.",
    });
    onAccept?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Before your first introduction</DialogTitle>
          <DialogDescription>
            A reminder of the two obligations that apply once a candidate accepts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {KEY_CLAUSES.map(clause => (
            <div key={clause.id} className="rounded-lg border border-[#008037]/25 bg-[#008037]/5 p-3">
              <p className="text-sm font-semibold text-gray-900">{clause.title}</p>
              <p className="text-xs text-gray-600 leading-relaxed mt-1">{clause.summary}</p>
            </div>
          ))}
          <p className="text-xs text-gray-500">
            These are sections 5 and 6 of the {RECRUITER_AGREEMENT_TITLE} you signed. The full agreement is
            available any time on your Account page.
          </p>
        </div>

        <div className="flex items-start space-x-2 mt-1">
          <Checkbox
            id="terms"
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(!!checked)}
            className="mt-0.5"
          />
          <label htmlFor="terms" className="text-sm text-gray-700 leading-snug">
            I understand the placement fee and communication obligations.
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-[#008037] hover:bg-[#006a2d]" onClick={handleAccept} disabled={!accepted}>
            Confirm and Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TermsDialog;
