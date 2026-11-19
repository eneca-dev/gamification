-- Хелпер для подсчёта занятого места в Supabase Storage по всем bucket'ам.
-- Вызывается из приложения перед аплоадом, чтобы блокировать новые файлы при
-- приближении к 70% плана Storage.

CREATE OR REPLACE FUNCTION public.get_storage_used_bytes()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)::bigint
  FROM storage.objects;
$$;

REVOKE ALL ON FUNCTION public.get_storage_used_bytes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_used_bytes() TO service_role;
