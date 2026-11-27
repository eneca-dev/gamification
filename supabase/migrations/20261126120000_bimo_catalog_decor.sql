-- Набор эмодзи фона Бимо: оформление вокруг персонажа в боковом меню
-- и на витрине гардероба. Задаётся админом при загрузке фона и правится
-- отдельным действием. Пустой набор — прежнее поведение: эмодзи товара
-- плюс нейтральные символы из кода.
alter table public.bimo_catalog
  add column if not exists decor jsonb not null default '[]'::jsonb;

-- Форму проверяем на границе: массив и не больше шести символов, остальное
-- (типы элементов, длина) отбрасывается на чтении функцией parseDecor.
alter table public.bimo_catalog
  drop constraint if exists bimo_catalog_decor_shape;
alter table public.bimo_catalog
  add constraint bimo_catalog_decor_shape check (
    jsonb_typeof(decor) = 'array' and jsonb_array_length(decor) <= 6
  );

comment on column public.bimo_catalog.decor is
  'Эмодзи-декор фона: массив строк, до 6 элементов. Только оформление, в образ не входит.';
