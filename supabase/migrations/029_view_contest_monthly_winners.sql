-- VIEW: один победитель на (тип конкурса × месяц) — для истории в админке
CREATE OR REPLACE VIEW view_contest_monthly_winners AS
SELECT DISTINCT ON (event_type, details->>'contest_month')
  event_type,
  details->>'contest_month'                            AS contest_month,
  COALESCE(details->>'department', details->>'team')   AS winner,
  (details->>'contest_score')::numeric                 AS contest_score,
  event_date
FROM gamification_event_logs
WHERE event_type IN (
  'team_contest_top1_bonus',
  'revit_team_contest_top1_bonus',
  'ws_dept_contest_top1_bonus',
  'ws_team_contest_top1_bonus'
)
ORDER BY event_type, details->>'contest_month' DESC;
