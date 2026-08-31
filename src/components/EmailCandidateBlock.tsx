import { useState } from 'react';
import { Mail, Info, Copy, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { gmailComposeUrl, CC_REMINDER } from '@/lib/emailCandidate';
import { SFC_CONTACT_EMAIL } from '@/lib/recruiterAgreement';

// Post-acceptance "contact the candidate" block, shared by the accepted
// intro card and the revealed dossier rail so the two can never drift:
//
//   [ Email candidate ] (i)   <- Gmail compose with talent@ cc'd; the (i)
//                                tooltip carries the cc obligation instead
//                                of a paragraph of always-visible copy
//   candidate@email.com  [copy]
//   cc talent@strategicfinancecareers.com  [copy]

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked (permissions/insecure context) — the address
          // itself stays selectable as a fallback.
        }
      }}
      className="p-1 rounded hover:bg-black/5 text-gray-400 hover:text-[#006a2d] transition-colors shrink-0"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-[#008037]" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

interface Props {
  email: string;
  subject: string;
}

export default function EmailCandidateBlock({ email, subject }: Props) {
  return (
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <a
          href={gmailComposeUrl(email, subject)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#008037] hover:bg-[#006a2d] text-white rounded-lg px-3 py-2 text-xs font-semibold transition-colors"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" />
          Email candidate
        </a>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About emailing this candidate"
              className="p-1.5 rounded-full text-gray-400 hover:text-[#006a2d] hover:bg-black/5 transition-colors shrink-0"
            >
              <Info className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
            Opens Gmail with {SFC_CONTACT_EMAIL} cc'd. {CC_REMINDER}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1 min-w-0">
        <span className="text-xs font-medium text-gray-700 truncate select-all">{email}</span>
        <CopyButton value={email} label="candidate email" />
      </div>
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-[11px] text-gray-400 shrink-0">cc</span>
        <span className="text-xs text-gray-500 truncate select-all">{SFC_CONTACT_EMAIL}</span>
        <CopyButton value={SFC_CONTACT_EMAIL} label="cc address" />
      </div>
    </div>
  );
}
