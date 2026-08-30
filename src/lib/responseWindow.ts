// Single source of truth for the candidate response window.
//
// This number is a TARGET, not a service commitment: it depends entirely
// on a third party (the candidate). Every place we state it should carry
// the footnote, and the recruiter terms disclaim it explicitly.
//
// Candidates agree to this window themselves, as a required checkbox on
// step 1 of the candidate application ("I commit to responding to all
// introduction requests within 48 hours"), which is what makes the claim
// defensible at all.

export const RESPONSE_WINDOW_HOURS = 48;
export const RESPONSE_WINDOW_LABEL = '48 hours';

/** Short marker placed next to any stated response time. */
export const RESPONSE_WINDOW_MARKER = '*';

/** The footnote itself. Keep the wording identical everywhere it appears. */
export const RESPONSE_WINDOW_FOOTNOTE =
  '*Candidates agree to a 48 hour response window when they join, and we send automated reminders. Response times depend on the candidate and are not guaranteed.';
