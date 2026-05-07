-- Восстанавливает UNIQUE INDEX на materialized views view_top_team_revit и view_top_dept_revit.
--
-- Контекст: миграции fix_revit_team_matview_per_capita (20260504121225) и
-- fix_revit_dept_matview_per_capita (20260504121232) сделали DROP MATERIALIZED VIEW + CREATE,
-- но не пересоздали unique-индексы. Из-за этого fn_ach_snapshot_rankings() падает на
-- REFRESH MATERIALIZED VIEW CONCURRENTLY с ошибкой 55000 (нужен unique index без WHERE).
--
-- Имена индексов — по конвенции _ws-близнецов: view_top_*_<col>_idx.
-- Уникальность гарантирована GROUP BY в определении matview.

CREATE UNIQUE INDEX IF NOT EXISTS view_top_team_revit_team_idx
  ON public.view_top_team_revit (team);

CREATE UNIQUE INDEX IF NOT EXISTS view_top_dept_revit_department_code_idx
  ON public.view_top_dept_revit (department_code);
