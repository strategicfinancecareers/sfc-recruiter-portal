// Single source of truth for promo / coupon codes. Server-side only —
// the client never sees the subscription code list; it validates through
// /api/validate-promo. Edit here to add or retire codes.

// Subscription codes granting a free trial (both billing modes: monthly
// bills $150/mo starting month 4; annual bills $1,200 at day 90).
export const FREE_MONTHS_CODES = ['SFCLAUNCH'];
export const FREE_TRIAL_DAYS = 90;

// Placement-fee codes. Display + bookkeeping: the fee is invoiced
// off-platform, so what matters is RECORDING the locked rate on the
// recruiter's row at checkout time (users.placement_fee_code / _usd).
export const PLACEMENT_FEE_STANDARD_USD = 10000;
export const PLACEMENT_FEE_CODES = {
  SFCEARLYBIRD: 5000,
};

export function normalizeCode(code) {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}
