-- Billing & coupon bookkeeping on users (all nullable, no backfill needed;
-- Stripe is still in test mode so there are no live subscribers to migrate).
--
-- Promo/coupon audit trail — written by create-checkout-session when a
-- recruiter starts checkout, so the locked placement rate is on record
-- at invoice time:
alter table public.users add column if not exists promo_code_used text;
alter table public.users add column if not exists placement_fee_code text;
alter table public.users add column if not exists placement_fee_usd integer;

-- Stripe linkage + subscription state — written by the payment-success
-- webhook; read by the Account page Billing section and billing-portal:
alter table public.users add column if not exists stripe_customer_id text;
alter table public.users add column if not exists stripe_subscription_id text;
alter table public.users add column if not exists subscription_plan text;
alter table public.users add column if not exists subscription_status text;
alter table public.users add column if not exists trial_end timestamptz;
alter table public.users add column if not exists current_period_end timestamptz;
alter table public.users add column if not exists subscribed_at timestamptz;
