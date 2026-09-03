-- Which columns an admin may change.
--
-- business_update_admin decides which *rows* an admin may update. Row
-- level security has nothing to say about *columns*, so that policy let
-- a yard admin run
--
--   update business set plan = 'centre'
--
-- from the browser and then add as many facilities as they liked. The
-- allowance trigger in 0010 reads business.plan, so the value it trusts
-- was one the caller controlled. Verified exploitable before this.
--
-- Column privileges are the only way to express this. They sit
-- underneath RLS: a write has to pass both.
revoke update on public.business from authenticated;

-- The yard's own details, and nothing that decides what it is entitled
-- to. plan and stripe_customer_id are set by the Stripe webhook, which
-- runs as the service role and is not subject to these grants. status
-- is the dormancy sweep's business.
grant update (name, timezone) on public.business to authenticated;
