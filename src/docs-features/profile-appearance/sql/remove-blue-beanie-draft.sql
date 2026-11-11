-- Approved 2026-11-10; executed via Supabase MCP. Data only, no schema changes.
begin;
do $$
declare v_product uuid; v_before jsonb; v_after jsonb; v_count integer;
begin
select c.product_id into strict v_product from public.bimo_catalog c join public.shop_products p on p.id=c.product_id where c.asset_key='accessory.blue_beanie' and c.slot='accessory' and not c.is_released and not p.is_active and not p.is_coming_soon and p.effect='bimo:accessory.blue_beanie' for update of c,p;
if exists(select 1 from public.shop_orders where product_id=v_product) or exists(select 1 from public.lottery_draws where product_id=v_product) or exists(select 1 from public.bimo_equipment where asset_key='accessory.blue_beanie') then raise exception 'Beanie has dependencies; deletion cancelled'; end if;
select jsonb_agg(jsonb_build_object('catalog',to_jsonb(c),'product',to_jsonb(p)) order by c.asset_key) into v_before from public.bimo_catalog c join public.shop_products p on p.id=c.product_id where c.asset_key<>'accessory.blue_beanie';
delete from public.bimo_catalog where asset_key='accessory.blue_beanie' and product_id=v_product;
get diagnostics v_count=row_count;
if v_count<>1 then raise exception 'Expected one catalog row'; end if;
delete from public.shop_products where id=v_product and effect='bimo:accessory.blue_beanie' and not is_active and not is_coming_soon;
get diagnostics v_count=row_count;
if v_count<>1 then raise exception 'Expected one draft product'; end if;
select jsonb_agg(jsonb_build_object('catalog',to_jsonb(c),'product',to_jsonb(p)) order by c.asset_key) into v_after from public.bimo_catalog c join public.shop_products p on p.id=c.product_id;
if v_before is distinct from v_after then raise exception 'Other Bimo rows changed; rollback'; end if;
end $$;
commit;
select (select count(*) from public.bimo_catalog) as remaining_catalog,
(select count(*) from public.shop_products where effect='bimo:accessory.blue_beanie') as beanie_products,
(select count(*) from public.bimo_catalog c join public.shop_products p on p.id=c.product_id where c.is_released or p.is_active or p.is_coming_soon) as visible_bimo;
