import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PenLine } from 'lucide-react';
import {
  RECRUITER_AGREEMENT_VERSION,
  RECRUITER_AGREEMENT_EFFECTIVE,
  KEY_CLAUSES,
  FULL_TERMS,
  type TermsSection,
} from '@/lib/recruiterAgreement';

// Renders the Recruiter Terms and Conditions, in one of two modes:
//
//   'view' — read-only. Used by the standalone dialog so a recruiter can
//            re-read what they signed at any time.
//   'sign' — adds a DocuSign-style initial box beside each of the two key
//            clauses (placement fee, communications) and a typed-name
//            signature block at the bottom.
//
// This is deliberately NOT a Dialog: PricingModal renders it inline as its
// second step (nesting Radix dialogs is fragile), and
// RecruiterAgreementDialog wraps it for standalone viewing.

export interface AgreementSignature {
  initialsFee: string;
  initialsComms: string;
  signature: string;
}

interface Props {
  mode: 'view' | 'sign';
  onSign?: (data: AgreementSignature) => void;
  onBack?: () => void;
  submitting?: boolean;
  error?: string;
  submitLabel?: string;
}

// Sections 5 and 6 are the initialed clauses and are rendered from
// KEY_CLAUSES between these two groups.
const sectionsBefore = FULL_TERMS.filter(s => s.number === '' || Number(s.number) <= 4);
const sectionsAfter = FULL_TERMS.filter(s => Number(s.number) >= 7);

export default function RecruiterAgreementContent({
  mode, onSign, onBack, submitting = false, error, submitLabel = 'Agree and continue to payment',
}: Props) {
  const signing = mode === 'sign';

  const [initialsFee, setInitialsFee] = useState('');
  const [initialsComms, setInitialsComms] = useState('');
  const [signature, setSignature] = useState('');

  const ready = initialsFee.trim().length >= 1 && initialsComms.trim().length >= 1 && signature.trim().length >= 2;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const renderSection = (s: TermsSection) => (
    <div key={s.number + s.title}>
      <p className="text-sm font-semibold text-gray-900">
        {s.number ? `${s.number}. ` : ''}{s.title}
      </p>
      {s.paragraphs.map((p, i) => (
        <p key={i} className="text-xs text-gray-600 leading-relaxed mt-1.5">{p}</p>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Scrollable agreement body */}
      <div className="border rounded-lg bg-white max-h-[46vh] overflow-y-auto p-4 space-y-4">
        <p className="text-[11px] text-gray-400">
          Version {RECRUITER_AGREEMENT_VERSION} · Effective {RECRUITER_AGREEMENT_EFFECTIVE}
        </p>

        {sectionsBefore.map(renderSection)}

        {/* The two clauses that get their own initials */}
        {KEY_CLAUSES.map(clause => (
          <div
            key={clause.id}
            className={signing
              ? 'rounded-lg border-2 border-[#008037]/30 bg-[#008037]/5 p-3'
              : 'rounded-lg border border-gray-200 bg-gray-50 p-3'}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{clause.number}. {clause.title}</p>
                <p className="text-xs text-[#005a26] font-medium mt-0.5">{clause.summary}</p>
              </div>
              {signing && (
                <div className="shrink-0 text-center">
                  <Input
                    value={clause.id === 'fee' ? initialsFee : initialsComms}
                    onChange={e => {
                      const v = e.target.value.toUpperCase().slice(0, 5);
                      if (clause.id === 'fee') setInitialsFee(v); else setInitialsComms(v);
                    }}
                    placeholder="__"
                    aria-label={`Initial the ${clause.title} clause`}
                    className="w-16 h-10 text-center font-bold tracking-widest bg-white border-[#008037]/40"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Initial</p>
                </div>
              )}
            </div>
            <ul className="mt-2 space-y-1.5">
              {clause.points.map((p, i) => (
                <li key={i} className="text-xs text-gray-600 leading-relaxed flex gap-2">
                  <span className="text-gray-300 shrink-0">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {sectionsAfter.map(renderSection)}
      </div>

      {/* Signature block */}
      {signing && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PenLine className="w-4 h-4 text-[#008037]" />
            <p className="text-sm font-semibold text-gray-900">Sign</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-600 mb-1">Type your full legal name</label>
              <Input
                value={signature}
                onChange={e => setSignature(e.target.value)}
                placeholder="Jane Smith"
                className="bg-white text-lg"
                style={{ fontFamily: 'var(--font-serif, Georgia), serif', fontStyle: 'italic' }}
              />
            </div>
            <div className="sm:w-44">
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <div className="h-10 flex items-center px-3 rounded-md border border-gray-200 bg-gray-100 text-sm text-gray-500">
                {today}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Typing your initials and name constitutes your electronic signature and has the same legal effect
            as a handwritten signature. We record your initials, name, the date, and the agreement version.
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {signing && (
        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" className="flex-1" onClick={onBack} disabled={submitting}>
              Back
            </Button>
          )}
          <Button
            className="flex-[2] bg-[#008037] hover:bg-[#006a2d]"
            disabled={!ready || submitting}
            onClick={() => onSign?.({
              initialsFee: initialsFee.trim(),
              initialsComms: initialsComms.trim(),
              signature: signature.trim(),
            })}
          >
            {submitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Opening checkout…</>
              : submitLabel}
          </Button>
        </div>
      )}
      {signing && !ready && (
        <p className="text-[11px] text-gray-400 text-center">
          Initial both highlighted clauses and type your full name to continue.
        </p>
      )}
    </div>
  );
}
