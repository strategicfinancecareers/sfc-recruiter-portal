import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, PenLine, AlertCircle } from 'lucide-react';
import {
  KEY_CLAUSES,
  FULL_TERMS,
  type TermsSection,
} from '@/lib/recruiterAgreement';

// Renders the Recruiter Terms and Conditions in one of two modes:
//
//   'sign' — the checkout step. Structure follows the way a person
//            actually reads this: TWO KEY ITEMS first, each with its own
//            initial box, then the complete terms below. The key items
//            show the plain-language summary; the full clause text still
//            appears in its numbered place in the document below, so the
//            agreement they scroll is complete, not a duplicate.
//   'view' — read-only, for pulling the agreement up later.
//
// Deliberately NOT a Dialog: PricingModal renders it inline as its second
// step (nesting Radix dialogs is fragile) and RecruiterAgreementDialog
// wraps it for standalone viewing.

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

const sectionsBefore = FULL_TERMS.filter(s => s.number === '' || Number(s.number) <= 4);
const sectionsAfter = FULL_TERMS.filter(s => Number(s.number) >= 7);

export default function RecruiterAgreementContent({
  mode, onSign, onBack, submitting = false, error, submitLabel = 'Agree and continue to payment',
}: Props) {
  const signing = mode === 'sign';

  const [initialsFee, setInitialsFee] = useState('');
  const [initialsComms, setInitialsComms] = useState('');
  const [signature, setSignature] = useState('');

  const bothInitialed = initialsFee.trim().length >= 1 && initialsComms.trim().length >= 1;
  const ready = bothInitialed && signature.trim().length >= 2;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const renderSection = (s: TermsSection) => (
    <div key={s.number + s.title}>
      <p className="text-[15px] font-semibold text-gray-900">
        {s.number ? `${s.number}. ` : ''}{s.title}
      </p>
      {s.paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-gray-600 leading-relaxed mt-2">{p}</p>
      ))}
    </div>
  );

  const renderFullClause = (clause: typeof KEY_CLAUSES[number]) => (
    <div key={clause.id}>
      <p className="text-[15px] font-semibold text-gray-900">{clause.number}. {clause.title}</p>
      <ul className="mt-2 space-y-2">
        {clause.points.map((p, i) => (
          <li key={i} className="text-sm text-gray-600 leading-relaxed flex gap-2">
            <span className="text-gray-300 shrink-0">•</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Two key items, initialed up front ─────────────────────────── */}
      {signing && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                We want to make you aware of two key items
              </p>
              <p className="text-sm text-amber-800 leading-relaxed mt-0.5">
                Please read each one and enter your initials in the box beside it. The complete terms follow below.
              </p>
            </div>
          </div>

          {KEY_CLAUSES.map((clause, idx) => {
            const value = clause.id === 'fee' ? initialsFee : initialsComms;
            const done = value.trim().length >= 1;
            return (
              <div
                key={clause.id}
                className={`rounded-xl border-2 p-4 transition-colors ${
                  done ? 'border-[#008037]/40 bg-[#008037]/5' : 'border-amber-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
                      Key item {idx + 1} of 2
                    </p>
                    <p className="text-base font-semibold text-gray-900">{clause.title}</p>
                    <p className="text-sm text-gray-700 leading-relaxed mt-1.5">{clause.summary}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Full text in section {clause.number} below.
                    </p>
                  </div>
                  <div className="shrink-0 text-center">
                    <Input
                      value={value}
                      onChange={e => {
                        const v = e.target.value.toUpperCase().slice(0, 5);
                        if (clause.id === 'fee') setInitialsFee(v); else setInitialsComms(v);
                      }}
                      placeholder="__"
                      aria-label={`Enter your initials to accept the ${clause.title} clause`}
                      className={`w-20 h-12 text-center text-lg font-bold tracking-widest bg-white ${
                        done ? 'border-[#008037]/50' : 'border-amber-400'
                      }`}
                    />
                    <p className="text-[11px] text-gray-500 mt-1 font-medium">Initials</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Full terms ─────────────────────────────────────────────────── */}
      <div>
        {signing && (
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            Complete terms and conditions
          </p>
        )}
        <div className="border rounded-lg bg-white max-h-[42vh] overflow-y-auto p-5 space-y-4">
          {sectionsBefore.map(renderSection)}
          {KEY_CLAUSES.map(renderFullClause)}
          {sectionsAfter.map(renderSection)}
        </div>
      </div>

      {/* ── Signature ──────────────────────────────────────────────────── */}
      {signing && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
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
                className="bg-white text-xl h-12"
                style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic' }}
              />
            </div>
            <div className="sm:w-48">
              <label className="block text-xs text-gray-600 mb-1">Date</label>
              <div className="h-12 flex items-center px-3 rounded-md border border-gray-200 bg-gray-100 text-sm text-gray-500">
                {today}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Typing your initials and name constitutes your electronic signature and has the same legal effect
            as a handwritten signature. You can download a copy of the signed agreement from your Account page.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {signing && (
        <>
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
          {!ready && (
            <p className="text-xs text-gray-400 text-center">
              {!bothInitialed
                ? 'Enter your initials on both key items above to continue.'
                : 'Type your full name to sign.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
