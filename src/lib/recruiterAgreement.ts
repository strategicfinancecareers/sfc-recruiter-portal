// SFC Talent Recruiter Terms and Conditions.
//
// Single source of truth for the agreement text. Rendered by
// RecruiterAgreementContent (signing flow at checkout + read-only viewer)
// and summarized by the intro-request confirmation dialog.
//
// TWO THINGS TO CONFIRM BEFORE RELYING ON THIS:
//   1. Have a lawyer review the text. It is drafted for clarity and to
//      protect the placement fee, but it is not attorney-drafted.
//   2. GOVERNING_LAW_STATE below is set to California based on SFC's
//      stated US Pacific business hours. Change it if that is wrong.
//
// Deliberately NO dollar amounts anywhere in this document: the fee is
// defined by reference to whatever was in effect for that recruiter's
// account at the time of the introduction, so pricing can change without
// re-papering every signed recruiter.
//
// Bump VERSION whenever the text changes. The accepted version is stored
// on users.recruiter_agreement_version, so you always know which text a
// given recruiter signed.

export const RECRUITER_AGREEMENT_VERSION = '1.0';
export const RECRUITER_AGREEMENT_EFFECTIVE = 'August 29, 2026';
export const RECRUITER_AGREEMENT_TITLE = 'SFC Talent Recruiter Terms and Conditions';

// CONFIRM THIS. Used in the governing-law and venue clause.
export const GOVERNING_LAW_STATE = 'California';

export const SFC_CONTACT_EMAIL = 'talent@strategicfinancecareers.com';

// ─── The two clauses that require separate initials ──────────────────────
// These are the commercial heart of the agreement, so they are called out
// visually and initialed individually rather than being buried in the
// scroll. Their full text also appears in FULL_TERMS at the same numbers.

export interface KeyClause {
  id: 'fee' | 'comms';
  number: string;
  title: string;
  summary: string;
  points: string[];
}

export const KEY_CLAUSES: KeyClause[] = [
  {
    id: 'fee',
    number: '5',
    title: 'Placement Fee',
    summary:
      'You owe a placement fee whenever you hire a candidate SFC introduced to you, including hires made outside the platform within 12 months of the introduction.',
    points: [
      'A placement fee is due for each Hire of a Candidate introduced to you through SFC Talent. The amount is the placement fee in effect for your account at the time of the Introduction, as shown at checkout and in your account.',
      'The fee is due within 15 days of the Candidate\'s start date, invoiced to the billing contact on your account.',
      'The fee applies to any Hire occurring within 12 months of the Introduction, whether or not the Hire was arranged through the Platform, and whether the Candidate was later contacted directly, reapplied, was referred, or came through a third party.',
      'The fee applies to Hires by you, your employer, or any Affiliate, in any paid capacity including employee, contractor, consultant, temporary, or advisory engagements.',
      'The fee is earned on the Candidate\'s start date and is not contingent on the Candidate\'s continued employment.',
      'Undisputed amounts not paid when due accrue interest at 1.5% per month or the maximum permitted by law, whichever is lower, and you are responsible for reasonable costs of collection, including attorneys\' fees.',
      'Subscription fees are for platform access only. They are separate from, and are not credited against, the placement fee.',
    ],
  },
  {
    id: 'comms',
    number: '6',
    title: 'Communications with Candidates',
    summary: `You will cc ${SFC_CONTACT_EMAIL} on all written communications with candidates SFC introduces to you.`,
    points: [
      `You agree to cc ${SFC_CONTACT_EMAIL} on all written communications with an introduced Candidate, from the Introduction until the Candidate is hired or withdrawn from consideration. This includes scheduling, interview coordination, offers, and rejections.`,
      'This allows SFC to support both sides of the process, keep the Candidate informed, and maintain an accurate record of each introduction.',
      'You agree not to ask a Candidate to move communications off the record, or to use alternate channels, for the purpose of avoiding this requirement.',
      'SFC may contact an introduced Candidate directly at any time to confirm the status of a process.',
    ],
  },
];

// ─── Full terms ──────────────────────────────────────────────────────────

export interface TermsSection {
  number: string;
  title: string;
  paragraphs: string[];
}

export const FULL_TERMS: TermsSection[] = [
  {
    number: '',
    title: 'Agreement',
    paragraphs: [
      `These Terms and Conditions (the "Terms") govern access to and use of the SFC Talent platform (the "Platform"), operated by Strategic Finance Careers ("SFC", "we", "us"). By creating a recruiter account, subscribing, or using the Platform, you ("you", "Recruiter") agree to these Terms.`,
      'If you are agreeing on behalf of a company or other organization, you represent that you have authority to bind that organization, and "you" refers to that organization.',
    ],
  },
  {
    number: '1',
    title: 'Definitions',
    paragraphs: [
      '"Candidate" means a professional whose profile is listed on the Platform.',
      '"Introduction" means SFC disclosing a Candidate\'s identity and contact details to you following that Candidate\'s acceptance of your introduction request.',
      '"Hire" means any engagement of a Candidate by you or an Affiliate in any paid capacity, including as an employee, contractor, consultant, temporary worker, or advisor, whether full-time or part-time.',
      '"Affiliate" means any entity that controls, is controlled by, or is under common control with your organization.',
      '"Placement Fee" means the fee payable on a Hire, in the amount in effect for your account at the time of the Introduction.',
    ],
  },
  {
    number: '2',
    title: 'Eligibility and Accounts',
    paragraphs: [
      'Recruiter accounts are available to recruiters and hiring managers hiring for real, funded roles. You agree to provide accurate and complete information about yourself, your organization, and the roles you are hiring for, and to keep that information current.',
      'All recruiter accounts are subject to review. SFC may approve, decline, or revoke access at its discretion.',
      'Accounts are personal to the individual who registered them. You may not share credentials or allow others to access the Platform through your account. You are responsible for all activity under your account and agree to notify SFC promptly of any unauthorized use.',
    ],
  },
  {
    number: '3',
    title: 'The Service',
    paragraphs: [
      'The Platform allows you to browse anonymized Candidate profiles and request introductions. SFC relays each request to the Candidate, who decides whether to accept. A Candidate\'s identity and contact details are disclosed only after that Candidate accepts.',
      'SFC does not guarantee that any Candidate will respond to, accept, or remain available following an introduction request, or that any Candidate will be suitable for your role.',
    ],
  },
  {
    number: '4',
    title: 'Subscription and Billing',
    paragraphs: [
      'Platform access is sold on a subscription basis, billed monthly or annually as selected at checkout. Subscriptions renew automatically until cancelled.',
      'You may cancel at any time. Cancellation of a monthly subscription takes effect at the end of the then-current monthly period; cancellation of an annual subscription takes effect at the end of the then-current annual term. Access continues until the end of the paid period.',
      'Where a promotional free period applies, charges begin at the end of that period unless you cancel first.',
      'Fees are exclusive of taxes, which are your responsibility. Except where required by law, fees are non-refundable, including for partial periods.',
      'SFC may change subscription pricing effective on your next renewal, with notice to the email on your account.',
      'If a subscription payment fails or remains unpaid, SFC may suspend access until the balance is settled.',
    ],
  },
  // Sections 5 and 6 are the initialed key clauses; their text is rendered
  // from KEY_CLAUSES so it can never drift out of sync with what was
  // initialed.
  {
    number: '7',
    title: 'Reporting a Hire',
    paragraphs: [
      `You agree to notify SFC at ${SFC_CONTACT_EMAIL} within 5 business days of an introduced Candidate accepting an offer from you or an Affiliate, including the Candidate's name, role title, and start date.`,
      'SFC may request written confirmation of the status of any introduced Candidate, and you agree to respond in good faith.',
    ],
  },
  {
    number: '8',
    title: 'Candidate Information and Confidentiality',
    paragraphs: [
      'Candidate identities, contact details, resumes, and profile information are confidential. You may use them solely to evaluate and pursue that Candidate for roles at your own organization.',
      'You may share Candidate information within your organization only with individuals directly involved in the relevant hiring decision, and only where those individuals are bound by equivalent confidentiality obligations.',
      'You may not disclose Candidate information to any third party, including other recruiters, agencies, or employers, and you may not scrape, bulk export, resell, license, or add Candidate information to any external database, distribution list, or marketing list.',
      'On termination of your account, or on SFC\'s written request, you will stop using and will delete Candidate information in your possession, except where retention is required by law or by your own records of an actual Hire.',
      'These obligations survive termination of your account.',
    ],
  },
  {
    number: '9',
    title: 'Acceptable Use',
    paragraphs: [
      'You agree to use the Platform only for genuine hiring. You may not post roles that do not exist, misrepresent your organization, the role, or the compensation offered, or use the Platform to solicit Candidates for any purpose other than employment with your organization.',
      'You agree to comply with all applicable laws in your use of the Platform, including employment, anti-discrimination, and data protection laws.',
      'You agree to communicate with Candidates professionally and to respond to accepted introductions in a timely manner.',
      'You may not attempt to identify anonymized Candidates outside the introduction process, access the Platform by automated means, scrape or copy Platform content, reverse engineer the Platform, or circumvent any security or access control.',
    ],
  },
  {
    number: '10',
    title: 'SFC\'s Role and Disclaimers',
    paragraphs: [
      'SFC operates an introduction platform. SFC is not the employer of any Candidate, is not a party to any employment relationship between you and a Candidate, and does not act as your agent.',
      'You are solely responsible for your hiring decisions and for all steps associated with them, including interviewing, background and reference checks, verification of work authorization, compensation, offer terms, and compliance with applicable law.',
      'Candidate profile information is provided by Candidates. SFC reviews profiles before listing them but does not verify or guarantee the accuracy or completeness of Candidate-provided information.',
      'The Platform is provided on an "as is" and "as available" basis. To the maximum extent permitted by law, SFC disclaims all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement.',
    ],
  },
  {
    number: '11',
    title: 'Intellectual Property',
    paragraphs: [
      'The Platform and all associated content, software, and branding are owned by SFC or its licensors. Subject to these Terms, SFC grants you a limited, revocable, non-exclusive, non-transferable license to access and use the Platform for your organization\'s internal recruiting.',
      'You may not copy, modify, distribute, sell, or create derivative works from the Platform or its content.',
      'If you provide feedback or suggestions, SFC may use them without restriction or obligation to you.',
    ],
  },
  {
    number: '12',
    title: 'Suspension and Termination',
    paragraphs: [
      'These Terms apply for as long as your account is active. You may cancel your subscription at any time as described above.',
      'SFC may suspend or terminate your access immediately, without refund, if you breach these Terms, fail to pay amounts when due, or engage in conduct that in SFC\'s reasonable judgment harms Candidates, other recruiters, or the Platform.',
      'Termination does not waive any obligation that has already accrued. In particular, placement fees owed, the 12-month fee obligation described in Section 5, the communication obligations for introductions already made, and the confidentiality obligations in Section 8 all survive termination.',
    ],
  },
  {
    number: '13',
    title: 'Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by law, SFC will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost revenue, lost business opportunity, or hiring costs, arising out of or relating to the Platform or these Terms.',
      'SFC\'s total aggregate liability arising out of or relating to the Platform or these Terms will not exceed the subscription fees you paid to SFC in the 12 months preceding the event giving rise to the claim.',
      'SFC is not liable for the conduct, performance, representations, or departure of any Candidate, or for any hiring decision you make.',
      'Nothing in these Terms limits liability that cannot be limited under applicable law.',
    ],
  },
  {
    number: '14',
    title: 'Indemnification',
    paragraphs: [
      'You agree to indemnify and hold harmless SFC and its officers, employees, and contractors from any claim, loss, liability, or expense, including reasonable attorneys\' fees, arising out of your use of the Platform, your hiring decisions or employment practices, your breach of these Terms, or your violation of any law or third-party right.',
    ],
  },
  {
    number: '15',
    title: 'Electronic Signature',
    paragraphs: [
      'You agree that your typed initials and typed name submitted through the Platform constitute your electronic signature, are intended to authenticate this agreement, and have the same legal effect as a handwritten signature under the U.S. Electronic Signatures in Global and National Commerce Act and applicable state law.',
      'SFC records the date and time of acceptance, the initials and name you provide, and the version of these Terms in effect at that time.',
    ],
  },
  {
    number: '16',
    title: 'Governing Law and Disputes',
    paragraphs: [
      `These Terms are governed by the laws of the State of ${GOVERNING_LAW_STATE}, without regard to its conflict of laws principles.`,
      `The parties will first attempt in good faith to resolve any dispute informally by contacting ${SFC_CONTACT_EMAIL}. Any dispute not resolved informally will be subject to the exclusive jurisdiction of the state and federal courts located in the State of ${GOVERNING_LAW_STATE}, and the parties consent to venue there.`,
      'In any action to collect placement fees or other amounts owed under these Terms, the prevailing party is entitled to recover its reasonable attorneys\' fees and costs.',
    ],
  },
  {
    number: '17',
    title: 'Changes to These Terms',
    paragraphs: [
      'SFC may update these Terms from time to time. Material changes will be notified to the email on your account or shown in the Platform. Continued use of the Platform after the effective date of a change constitutes acceptance of the updated Terms.',
      'Placement fee obligations arising from introductions made before a change continue to be governed by the version of these Terms you accepted at the time of that introduction.',
    ],
  },
  {
    number: '18',
    title: 'General',
    paragraphs: [
      'These Terms, together with the pricing shown at checkout and in your account, are the entire agreement between you and SFC regarding the Platform, and supersede any prior understanding on the subject.',
      'If any provision is held unenforceable, the remaining provisions remain in effect and the unenforceable provision will be modified to the minimum extent necessary to make it enforceable.',
      'SFC\'s failure to enforce any provision is not a waiver of its right to do so later.',
      'You may not assign these Terms without SFC\'s written consent. SFC may assign these Terms in connection with a merger, acquisition, or sale of assets.',
      'The parties are independent contractors. These Terms do not create a partnership, joint venture, agency, or employment relationship.',
      `Notices to SFC should be sent to ${SFC_CONTACT_EMAIL}. Notices to you will be sent to the email on your account.`,
    ],
  },
];
