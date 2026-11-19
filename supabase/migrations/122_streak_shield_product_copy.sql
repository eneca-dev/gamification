UPDATE public.shop_products
SET description = 'Защита стрика Worksection. Покупается заранее и сохраняется до применения. При угрозе сначала расходуются бесплатные жизни, затем купленные защиты.',
    updated_at = now()
WHERE effect = 'streak_shield_ws';

UPDATE public.shop_products
SET description = 'Защита стрика Revit. Покупается заранее и сохраняется до применения. При угрозе сначала расходуются бесплатные жизни, затем купленные защиты.',
    updated_at = now()
WHERE effect = 'streak_shield_revit';
