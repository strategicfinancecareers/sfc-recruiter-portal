import { SFC_CONTACT_EMAIL } from './recruiterAgreement';

// Gmail compose link for contacting a matched candidate, with
// talent@strategicfinancecareers.com pre-filled as cc.
//
// The cc is the recruiter's Section 6 obligation (they initialed it), so
// every "email the candidate" affordance in the product routes through
// this helper rather than a bare mailto: the compliant path should always
// be the easy path. Gmail compose is used per product decision (target
// audience is on Google Workspace); the recruiter can still copy the
// address manually if they use another client.

export function gmailComposeUrl(to: string, subject?: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to,
    cc: SFC_CONTACT_EMAIL,
    ...(subject ? { su: subject } : {}),
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export const CC_REMINDER =
  `Keep ${SFC_CONTACT_EMAIL} cc'd on all emails with this candidate, as agreed in your recruiter terms.`;
