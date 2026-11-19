-- Новые таблицы читаются и меняются только через проверенные серверные действия.
REVOKE ALL ON public.streak_shield_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.streak_shield_credits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.company_news FROM PUBLIC, anon, authenticated;

-- Старые RPC принимают произвольный user_id, а перегрузка с p_free может
-- создавать бесплатный заказ. В приложении обе вызываются только service_role.
REVOKE ALL ON FUNCTION public.purchase_product(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_product(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_product(uuid, uuid, text) TO service_role;
