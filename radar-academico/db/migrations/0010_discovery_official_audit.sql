-- A watch target may be scheduled only after a recorded review of its exact official URL.
alter table discovery_targets add column official_verified_at timestamptz;
alter table discovery_targets add column official_verified_url text;
alter table discovery_targets add column official_verified_by text;
alter table discovery_targets add column official_review_note text;
alter table discovery_targets alter column enabled set default false;

-- These seed pages were checked against their organizers' or institutions' official sites.
-- Matching the URL prevents an edited target from inheriting the seed review.
update discovery_targets target set
  official_verified_at = now(),
  official_verified_url = target.official_url,
  official_verified_by = 'initial-official-review-2026-10-14',
  official_review_note = 'Página e domínio oficiais conferidos na curadoria inicial.'
from (values
  ('cnpq-chamadas-abertas','https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas'),
  ('finep-chamadas','https://www.finep.gov.br/chamadas-publicas'),
  ('sebrae-programas','https://programas.sebraestartups.com.br/index/programas'),
  ('sebrae-eventos-pa','https://pa.loja.sebrae.com.br/eventos'),
  ('startup-summit','https://www.startupsummit.com.br/'),
  ('tdc','https://www.thedevconf.com/tdc/2026/datas-e-locais'),
  ('nasa-space-apps','https://www.spaceappschallenge.org/'),
  ('sebrae-startup-day','https://sebrae.com.br/subsites/startup-day'),
  ('snct','https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/popciencia'),
  ('feira-empreendedor-sp','https://feiradoempreendedor.sebraesp.com.br/visitantes/'),
  ('web-summit-rio','https://rio.websummit.com/pt-br/'),
  ('rio-innovation-week','https://rioinnovationweek.com.br/'),
  ('campus-party-brasil','https://brasil.campus-party.org/ingressos-disponiveis/'),
  ('premio-sebrae-startups','https://programas.sebraestartups.com.br/in/premiosebraestartups2026')
) as reviewed(id, official_url)
where target.id = reviewed.id and target.official_url = reviewed.official_url;

-- Unknown or changed pages stay in the private list but cannot be crawled.
update discovery_targets set enabled = false, next_check_at = null, updated_at = now()
where official_verified_at is null;

alter table discovery_targets add constraint discovery_targets_enabled_official_review
  check (not enabled or (
    official_verified_at is not null and
    official_verified_url is not null and
    official_verified_url = official_url and
    official_verified_by is not null and btrim(official_verified_by) <> '' and
    official_review_note is not null and btrim(official_review_note) <> ''
  ));
