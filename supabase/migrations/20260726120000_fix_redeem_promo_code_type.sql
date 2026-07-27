-- redeem_promo_code declared `reward_type text` but promo_codes.reward_type is
-- varchar, so `return query select v_row.reward_type, ...` raised "structure
-- of query does not match function result type" on every redemption attempt.
-- Cast explicitly to match the declared OUT column.
create or replace function public.redeem_promo_code(p_code text)
returns table (reward_type text, reward_value integer)
language plpgsql
security definer set search_path = public
as $$
declare
  v_row public.promo_codes%rowtype;
begin
  update public.promo_codes
  set used_count = used_count + 1
  where upper(code) = upper(p_code)
    and is_active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
  returning * into v_row;

  if v_row.id is null then
    if exists (
      select 1 from public.promo_codes
      where upper(code) = upper(p_code) and is_active = true
        and (expires_at is null or expires_at > now())
    ) then
      raise exception 'Promo code fully claimed.';
    else
      raise exception 'Invalid or expired promo code.';
    end if;
  end if;

  return query select v_row.reward_type::text, v_row.reward_value;
end;
$$;

revoke execute on function public.redeem_promo_code(text) from anon, authenticated;
