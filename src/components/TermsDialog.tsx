
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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
    if (accepted) {
      acceptTerms();
      onOpenChange(false);
      toast({
        title: "Terms accepted",
        description: "You can now request introductions to candidates.",
      });
      
      // Call the optional onAccept callback
      if (onAccept) {
        onAccept();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Terms and Conditions</DialogTitle>
          <DialogDescription>
            Please accept our terms for candidate placement and fees before proceeding.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="bg-gray-50 p-4 rounded-lg text-sm space-y-3">
            <h4 className="font-medium">Placement Terms:</h4>
            <ul className="space-y-2 text-gray-600">
              <li>• Placement fee: 20% of first-year salary</li>
              <li>• 90-day replacement guarantee</li>
              <li>• Payment due within 30 days of candidate start date</li>
              <li>• Introduction does not guarantee placement</li>
              <li>• All communications are confidential</li>
            </ul>
          </div>
          <div className="flex items-center space-x-2 mt-4">
            <Checkbox
              id="terms"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(!!checked)}
            />
            <label htmlFor="terms" className="text-sm">
              I accept the terms and conditions for candidate placement and fees
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAccept} disabled={!accepted}>
            Accept and Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TermsDialog;
