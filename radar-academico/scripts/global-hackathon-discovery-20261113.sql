-- Run only after the eligibility-aware Radar candidate is deployed.
-- Configuration only; do not reactivate existing paused targets or alter schemas.
BEGIN;
SET LOCAL app.is_admin='true';
INSERT INTO discovery_targets
 (id,name,organizer,kind,official_url,topics,priority,enabled,check_interval_hours,
  evidence_url,official_verified_at,official_verified_url,official_verified_by,official_review_note,notes)
VALUES
 ('global-wemakedevs-hackathons','WeMakeDevs — hackathons globais','WeMakeDevs','site',
  'https://www.wemakedevs.org/hackathons',ARRAY['competicoes','eventos','tecnologia','ia','eligibility-br-required'],90,true,24,
  'https://www.wemakedevs.org/hackathons',now(),'https://www.wemakedevs.org/hackathons','operator:global-hackathons-20261113',
  'Organizador, lista oficial e robots conferidos em 13/11/2026. Cada edição exige fonte, prazo e elegibilidade para residentes no Brasil próprios.',
  'radar:global-hackathons:v1; público brasileiro; eventos presenciais no exterior exigem condições explícitas.'),
 ('global-google-developer-events','Google for Developers — eventos globais','Google','site',
  'https://developers.google.com/events',ARRAY['competicoes','eventos','tecnologia','ia','eligibility-br-required'],90,true,24,
  'https://developers.google.com/events',now(),'https://developers.google.com/events','operator:global-hackathons-20261113',
  'Lista institucional Google e robots conferidos em 13/11/2026. Páginas de terceiros exigem autoria e regulamento próprios; não herdam autorização genérica.',
  'radar:global-hackathons:v1; não altera o alvo GDG previamente pausado.'),
 ('global-kiro-events','Kiro / AWS — eventos e hackathons globais','Amazon Web Services','site',
  'https://kiro.dev/events/',ARRAY['competicoes','eventos','tecnologia','ia','eligibility-br-required'],90,true,24,
  'https://kiro.dev/events/',now(),'https://kiro.dev/events/','operator:global-hackathons-20261113',
  'Canal oficial Kiro e robots conferidos em 13/11/2026. A edição Kiroween 2026 exclui o Brasil; um link da lista não prova autoria ou elegibilidade de parceiros.',
  'radar:global-hackathons:v1; exclusões por país e elegibilidade desconhecida impedem publicação automática.')
ON CONFLICT(id) DO NOTHING;
COMMIT;
