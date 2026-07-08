-- Extract help_articles.folder/folder_label into a dedicated help_folders table
create table public.help_folders (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint help_folders_pkey primary key (id),
  constraint help_folders_slug_key unique (slug)
);

insert into public.help_folders (slug, label, sort_order) values
  ('general', 'Общее', 1),
  ('ws', 'Worksection', 2),
  ('revit', 'Автоматизация', 3),
  ('shields', 'Вторая жизнь', 4),
  ('gratitudes', 'Благодарности', 5),
  ('achievements', 'Достижения', 6),
  ('store', 'Магазин', 7),
  ('day-off', 'Дни за свой счёт', 8),
  ('chatbot', 'Чат-бот: определения', 9);

alter table public.help_articles add column folder_id uuid;

update public.help_articles a
set folder_id = f.id
from public.help_folders f
where f.slug = a.folder;

alter table public.help_articles
  alter column folder_id set not null,
  add constraint help_articles_folder_id_fkey foreign key (folder_id) references public.help_folders (id);

create index idx_help_articles_folder_id on public.help_articles using btree (folder_id);

drop index if exists public.idx_help_articles_folder;

alter table public.help_articles
  drop column folder,
  drop column folder_label;

alter table public.help_folders enable row level security;

create policy "help_folders_read" on public.help_folders
  for select
  using (true);

create policy "help_folders_admin_insert" on public.help_folders
  for insert
  with check (exists (select 1 from ws_users where ws_users.id = (select auth.uid()) and ws_users.is_admin = true));

create policy "help_folders_admin_update" on public.help_folders
  for update
  using (exists (select 1 from ws_users where ws_users.id = (select auth.uid()) and ws_users.is_admin = true));

create policy "help_folders_admin_delete" on public.help_folders
  for delete
  using (exists (select 1 from ws_users where ws_users.id = (select auth.uid()) and ws_users.is_admin = true));
