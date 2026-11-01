-- Existing subscriptions retain their edition, consent, status and snapshots.
ALTER TABLE opportunity_alert_subscriptions ALTER COLUMN opportunity_id DROP NOT NULL;
ALTER TABLE opportunity_alert_subscriptions ADD COLUMN target_id text REFERENCES discovery_targets(id);
ALTER TABLE opportunity_alert_subscriptions ADD CONSTRAINT alert_subscription_one_scope
  CHECK ((opportunity_id IS NULL) <> (target_id IS NULL));
CREATE UNIQUE INDEX alert_subscription_series_recipient ON opportunity_alert_subscriptions(target_id,email);

-- Existing NASA pilot: only this reviewed identity/source pair is linked.
-- Other targets require an explicit audited source mapping before edition alerts.
UPDATE discovery_targets SET mapped_source_id='nasa-space-apps-2026'
WHERE id='nasa-space-apps' AND mapped_source_id IS NULL
  AND official_url='https://www.spaceappschallenge.org/'
  AND official_verified_at IS NOT NULL
  AND EXISTS(SELECT 1 FROM official_sources WHERE id='nasa-space-apps-2026'
    AND base_url='https://www.spaceappschallenge.org/2026/');

-- The seven edition-specific sources from the audited expansion; generic portals
-- are deliberately excluded. Do not replace an operator's existing mapping.
UPDATE discovery_targets target SET mapped_source_id=link.source_id
FROM (VALUES
  ('exp-olimpiada-de-literatura','exp-literatura-16-2026','https://www.olimpiadadeliteratura.com.br/','https://www.olimpiadadeliteratura.com.br/'),
  ('exp-olimpiada-do-oceano','exp-oceano-2026','https://olimpiada.maredeciencia.eco.br/','https://olimpiada.maredeciencia.eco.br/'),
  ('exp-obapo-2027-watch','exp-obapo-2027','https://olimpikei.com.br/obapo-2027-renovacao/','https://olimpikei.com.br/obapo-2027-renovacao/'),
  ('exp-hackbr','exp-hack-brasil-2026','https://hackbrasil.com/','https://hackbrasil.com/'),
  ('exp-pucpr-ia-2026-watch','exp-pucpr-ia-2026','https://www.pucpr.br/noticias/destaque/pucpr-abre-inscricoes-para-hackathon-de-inteligencia-artificial-em-parceria-com-o-google/','https://www.pucpr.br/noticias/destaque/pucpr-abre-inscricoes-para-hackathon-de-inteligencia-artificial-em-parceria-com-o-google/'),
  ('exp-ufms-cidada-2026-watch','exp-ufms-cidada-2026','https://www.ufms.br/inscricoes-para-o-2o-hackathon-do-nucleo-de-formacao-cidada-vao-ate-9-de-novembro/','https://www.ufms.br/inscricoes-para-o-2o-hackathon-do-nucleo-de-formacao-cidada-vao-ate-9-de-novembro/'),
  ('exp-pmi-impacto-2026-watch','exp-pmi-impacto-2026','https://www.sympla.com.br/evento-online/lgc/3618075','https://www.sympla.com.br/evento-online/lgc/3618075')) AS link(target_id,source_id,target_url,source_url)
WHERE target.id=link.target_id AND target.mapped_source_id IS NULL
  AND target.official_url=link.target_url AND target.official_verified_at IS NOT NULL
  AND EXISTS(SELECT 1 FROM official_sources source WHERE source.id=link.source_id AND source.base_url=link.source_url);
