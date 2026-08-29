// SFC Talent Recruiter Agreement — the click-through shown before payment.
// Bump the VERSION any time the clauses change; the accepted version is
// stored on users.recruiter_agreement_version so you always know exactly
// which text a recruiter agreed to.
//
// NOTE: drafted for clarity, not by a lawyer. Have counsel review before
// relying on it in a dispute.

export const RECRUITER_AGREEMENT_VERSION = '1.0';

export const RECRUITER_AGREEMENT_TITLE = 'SFC Talent Recruiter Agreement';

export const RECRUITER_AGREEMENT_CLAUSES: Array<{ title: string; body: string }> = [
  {
    title: '1. Placement fee',
    body:
      'A placement fee is due for every hire of a candidate introduced through SFC Talent: $15,000 per placement, or $5,000 per placement if an early bird code was applied to your account. The fee is due within 15 days of the candidate\'s start date. The fee applies to any hire of an SFC-introduced candidate made within 12 months of the introduction, whether or not the hire is arranged through the platform.',
  },
  {
    title: '2. Communications',
    body:
      'You agree to cc talent@strategicfinancecareers.com on all communications with candidates introduced through SFC Talent, from first contact until the candidate is hired or passed on.',
  },
  {
    title: '3. Hire reporting',
    body:
      'You agree to report any hire of an SFC-introduced candidate to talent@strategicfinancecareers.com within 5 business days of the offer being accepted.',
  },
  {
    title: '4. Confidentiality',
    body:
      'Candidate identities, contact details, resumes, and profile information are confidential. They may be used only for your company\'s own hiring and may not be shared outside your organization, scraped, resold, or used for any other purpose.',
  },
  {
    title: '5. Account integrity',
    body:
      'You agree to provide accurate company information and to keep your login personal. One account represents one hiring organization.',
  },
  {
    title: '6. Violations',
    body:
      'Violation of this agreement results in immediate termination of platform access without refund. Any placement fee owed remains due, and Strategic Finance Careers reserves all legal remedies.',
  },
  {
    title: '7. Subscription billing',
    body:
      'Monthly subscriptions are billed monthly and can be canceled anytime, effective at the end of the current month. Annual subscriptions are billed once per year and renew annually unless canceled before renewal. Promotional free months, when applied, delay the first charge accordingly.',
  },
];
