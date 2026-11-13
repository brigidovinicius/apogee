-- Operator-authorized configuration; no schema migration or blanket publication.
-- Each page still needs current evidence, scope, robots and editorial checks.
-- ON CONFLICT preserves an administrator's existing settings and exclusions.
BEGIN;
SET LOCAL app.is_admin='true';
INSERT INTO discovery_targets
  (id,name,organizer,kind,official_url,topics,priority,enabled,check_interval_hours,
   evidence_url,official_verified_at,official_verified_url,official_verified_by,official_review_note,notes)
VALUES
  ('exp-inpe-eventos','INPE — agenda de eventos','Instituto Nacional de Pesquisas Espaciais','site',
   'https://www.gov.br/inpe/pt-br/assuntos/eventos',ARRAY['astronomia','eventos','formacao'],94,true,24,
   'https://www.gov.br/inpe/pt-br/assuntos/eventos',now(),'https://www.gov.br/inpe/pt-br/assuntos/eventos','operator:astronomia-20261112',
   'Página institucional INPE e robots gov.br verificados em 12/11/2026; descoberta autorizada pelo usuário. Conferir a edição e inscrição de cada oferta.',
   'radar:space-discovery:20261112; agenda oficial, sem presumir inscrição aberta.'),
  ('exp-inpe-oportunidades','INPE — oportunidades abertas','Instituto Nacional de Pesquisas Espaciais','site',
   'https://www.gov.br/inpe/pt-br/assuntos/anuncio-de-oportunidades/abertos',ARRAY['astronomia','pesquisa','bolsas','carreira'],94,true,24,
   'https://www.gov.br/inpe/pt-br/assuntos/anuncio-de-oportunidades/abertos',now(),'https://www.gov.br/inpe/pt-br/assuntos/anuncio-de-oportunidades/abertos','operator:astronomia-20261112',
   'Listagem institucional INPE e robots gov.br verificados em 12/11/2026. A seção Abertos não substitui o prazo e os requisitos de cada chamada.',
   'radar:space-discovery:20261112; cada chamada exige evidência própria.'),
  ('exp-aeb-noticias','AEB — novas chamadas e eventos','Agência Espacial Brasileira','site',
   'https://www.gov.br/aeb/pt-br/assuntos/noticias',ARRAY['astronomia','eventos','formacao','competicoes'],94,true,24,
   'https://www.gov.br/aeb/pt-br/assuntos/noticias',now(),'https://www.gov.br/aeb/pt-br/assuntos/noticias','operator:astronomia-20261112',
   'Canal institucional AEB e robots gov.br verificados em 12/11/2026. Notícias de resultados, lançamentos e atividades passadas não comprovam oportunidade de participação.',
   'radar:space-discovery:20261112; descobrir somente ofertas com participação comprovada.'),
  ('exp-aeb-escola','AEB Escola — programas e atividades','Agência Espacial Brasileira','site',
   'https://www.gov.br/aeb/pt-br/acoes-e-programas/aeb-escola-1/conheca-o-programa-aeb-escola',ARRAY['astronomia','formacao','eventos','competicoes'],94,true,24,
   'https://www.gov.br/aeb/pt-br/acoes-e-programas/aeb-escola-1/conheca-o-programa-aeb-escola',now(),'https://www.gov.br/aeb/pt-br/acoes-e-programas/aeb-escola-1/conheca-o-programa-aeb-escola','operator:astronomia-20261112',
   'Programa e robots gov.br verificados em 12/11/2026. O ambiente externo AEB Escola Virtual exige transporte e robots próprios; não herda autorização de coleta desta página.',
   'radar:space-discovery:20261112; não confundir programa institucional ou material didático com inscrição aberta.')
ON CONFLICT(id) DO NOTHING;
COMMIT;
