-- Closes direct client access to every SECURITY DEFINER function.
--
-- Earlier migrations revoked EXECUTE on these from anon and authenticated
-- only, but Postgres also grants EXECUTE on every new function to PUBLIC,
-- and both roles inherit it -- so those revokes never took effect. Verified
-- live 2026-11-05: anon-key POSTs to /rest/v1/rpc/deduct_credits,
-- refund_credits, admin_adjust_credits and redeem_promo_code all reached the
-- function bodies, i.e. anyone holding the public anon key could mint or
-- drain credits on any account. check_rate_limit was never revoked at all
-- (anyone could flood rate_limit_hits or pre-fill another user's bucket).
--
-- Every app call site (lib/server/credits.ts, promo-codes.ts, rate-limit.ts)
-- goes through the service-role client, which is re-granted explicitly below
-- so this can't lock the app out.
--
-- Rule for new SECURITY DEFINER functions: revoke from public too, not just
-- anon/authenticated.

revoke execute on function public.deduct_credits(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.refund_credits(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.admin_adjust_credits(text, uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.redeem_promo_code(text, uuid) from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, int) from public, anon, authenticated;
-- handle_new_user() is deliberately left alone: it returns `trigger`, so
-- PostgREST can't expose it, and it fires as supabase_auth_admin on signup.

grant execute on function public.deduct_credits(uuid, integer, text, text) to service_role;
grant execute on function public.refund_credits(uuid, integer, text, text) to service_role;
grant execute on function public.admin_adjust_credits(text, uuid, integer, text) to service_role;
grant execute on function public.redeem_promo_code(text, uuid) to service_role;
grant execute on function public.check_rate_limit(text, int) to service_role;
