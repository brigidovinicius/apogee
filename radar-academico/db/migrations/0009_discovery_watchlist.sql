-- Discovery is separate from the verified sources and live opportunity catalogue.
-- A lead never becomes an opportunity solely because it appears here.
create table if not exists discovery_targets (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null,
  organizer text not null,
  kind text not null check (kind in ('site','program','event_series')),
  official_url text not null,
  topics text[] not null default '{}',
  priority integer not null default 0,
  enabled boolean not null default true,
  check_interval_hours integer not null default 24 check (check_interval_hours between 24 and 720),
  next_check_at timestamptz,
  last_checked_at timestamptz,
  last_status text not null default 'not_checked' check (last_status in ('not_checked','checked','blocked','failed')),
  mapped_source_id text references official_sources(id),
  evidence_url text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists discovery_leads (
  id uuid primary key default gen_random_uuid(),
  target_id text not null references discovery_targets(id),
  url text not null,
  title text not null,
  excerpt text not null default '',
  status text not null default 'new' check (status in ('new','reviewing','mapped','dismissed')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (target_id, url)
);

create table if not exists annual_event_editions (
  id text primary key,
  target_id text not null references discovery_targets(id),
  edition_year integer not null check (edition_year between 2020 and 2100),
  edition_name text not null,
  starts_on date,
  ends_on date,
  location_text text,
  status text not null check (status in ('announced','past','cancelled','unconfirmed')),
  evidence_url text not null,
  checked_at timestamptz not null,
  check (ends_on is null or starts_on is not null and ends_on >= starts_on)
);

create index if not exists discovery_targets_due_idx on discovery_targets(next_check_at, priority desc, id) where enabled;
create index if not exists discovery_leads_status_idx on discovery_leads(status, last_seen_at desc);
create index if not exists annual_event_editions_start_idx on annual_event_editions(starts_on);

alter table discovery_targets enable row level security;
alter table discovery_targets force row level security;
alter table discovery_leads enable row level security;
alter table discovery_leads force row level security;
alter table annual_event_editions enable row level security;
alter table annual_event_editions force row level security;
create policy discovery_targets_admin on discovery_targets for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');
create policy discovery_leads_admin on discovery_leads for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');
create policy annual_event_editions_admin on annual_event_editions for all using (current_setting('app.is_admin', true) = 'true') with check (current_setting('app.is_admin', true) = 'true');

insert into discovery_targets (id,name,organizer,kind,official_url,topics,priority,evidence_url,notes) values
  ('cnpq-chamadas-abertas','Chamadas abertas CNPq','CNPq','site','https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas',array['pesquisa','inovação'],100,'https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas','Descoberta; cada chamada exige elegibilidade e prazo próprios.'),
  ('finep-chamadas','Chamadas públicas Finep','Finep','site','https://www.finep.gov.br/chamadas-publicas',array['inovação','empreendedorismo'],95,'https://www.finep.gov.br/chamadas-publicas','Muitas chamadas são institucionais ou empresariais.'),
  ('sebrae-programas','Programas Sebrae Startups','Sebrae Startups','site','https://programas.sebraestartups.com.br/index/programas',array['empreendedorismo','inovação'],90,'https://programas.sebraestartups.com.br/index/programas','Descobrir programas e novas edições; cada inscrição deve ser confirmada.'),
  ('sebrae-eventos-pa','Agenda de eventos Sebrae Pará','Sebrae','site','https://pa.loja.sebrae.com.br/eventos',array['empreendedorismo','tecnologia'],75,'https://pa.loja.sebrae.com.br/eventos','Fonte regional para descoberta; não pressupõe abrangência nacional.'),
  ('startup-summit','Startup Summit','Sebrae Startups e ACATE','event_series','https://www.startupsummit.com.br/',array['empreendedorismo','tecnologia'],95,'https://www.startupsummit.com.br/','Edição de 2026 encerrada; acompanhar próximas inscrições oficiais.'),
  ('tdc','The Developer’s Conference','Globalcode','event_series','https://www.thedevconf.com/tdc/2026/datas-e-locais',array['tecnologia','carreira'],85,'https://www.thedevconf.com/tdc/2026/datas-e-locais','Várias edições por ano. Respeitar robots; não presumir inscrição aberta.'),
  ('nasa-space-apps','NASA Space Apps Challenge','NASA','event_series','https://www.spaceappschallenge.org/',array['hackathon','ciência','tecnologia'],95,'https://www.spaceappschallenge.org/','Hackathon global; verificar edição e local brasileiro antes de publicar.'),
  ('sebrae-startup-day','Startup Day','Sebrae Startups','event_series','https://sebrae.com.br/subsites/startup-day',array['empreendedorismo','comunidades'],85,'https://sebrae.com.br/subsites/startup-day','Edições locais podem ter inscrição e local diferentes.'),
  ('snct','Semana Nacional de Ciência e Tecnologia','MCTI','event_series','https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/popciencia',array['ciência','tecnologia'],85,'https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/noticias/2026/05/23a-semana-nacional-de-ciencia-e-tecnologia-homenageara-mulheres-cientistas','A agenda nacional reúne eventos locais; checar cada inscrição.'),
  ('feira-empreendedor-sp','Feira do Empreendedor Sebrae-SP','Sebrae-SP','event_series','https://feiradoempreendedor.sebraesp.com.br/visitantes/',array['empreendedorismo','comunidades'],90,'https://feiradoempreendedor.sebraesp.com.br/visitantes/','Edição 2026 gratuita e híbrida; inscrição precisa ser confirmada na ficha oficial.'),
  ('web-summit-rio','Web Summit Rio','Web Summit','event_series','https://rio.websummit.com/pt-br/',array['empreendedorismo','tecnologia'],85,'https://rio.websummit.com/web-summit-rio-2027/','Edição 2027 anunciada; pré-registro não prova inscrição definitiva.'),
  ('rio-innovation-week','Rio Innovation Week','Rio Innovation Week','event_series','https://rioinnovationweek.com.br/',array['inovação','tecnologia'],80,'https://www.gov.br/anp/pt-br/acesso-a-informacao/agenda-eventos/rio-innovation-week','Edição 2026 passada; acompanhar anúncio da próxima.'),
  ('campus-party-brasil','Campus Party Brasil','Campus Party','event_series','https://brasil.campus-party.org/ingressos-disponiveis/',array['tecnologia','comunidades'],75,'https://brasil.campus-party.org/reembolso/','CPBR18 2026 foi cancelada; não publicar como evento ativo.'),
  ('premio-sebrae-startups','Prêmio Sebrae Startups','Sebrae Startups','program','https://programas.sebraestartups.com.br/in/premiosebraestartups2026',array['empreendedorismo','competição'],80,'https://programas.sebraestartups.com.br/in/premiosebraestartups2026','Inscrições de 2026 encerradas; conferir novas edições no portal de programas.')
on conflict (id) do nothing;

insert into annual_event_editions (id,target_id,edition_year,edition_name,starts_on,ends_on,location_text,status,evidence_url,checked_at) values
  ('startup-summit-2026','startup-summit',2026,'Startup Summit 2026','2026-08-26','2026-08-28','Florianópolis, SC','past','https://www.startupsummit.com.br/','2026-10-14T00:00:00Z'),
  ('tdc-rnp-2026','tdc',2026,'TDC RNP 2026','2026-11-11','2026-11-12',null,'announced','https://www.thedevconf.com/tdc/2026/datas-e-locais','2026-10-14T00:00:00Z'),
  ('tdc-poa-2026','tdc',2026,'TDC Porto Alegre 2026','2026-12-09','2026-12-10','Porto Alegre, RS','announced','https://www.thedevconf.com/tdc/2026/datas-e-locais','2026-10-14T00:00:00Z'),
  ('space-apps-2026','nasa-space-apps',2026,'NASA Space Apps Challenge 2026','2026-11-14','2026-11-15','Global; locais no Brasil','announced','https://www.spaceappschallenge.org/','2026-10-14T00:00:00Z'),
  ('startup-day-2026','sebrae-startup-day',2026,'Startup Day 2026','2026-03-21','2026-03-21','Diversas cidades brasileiras','past','https://go.loja.sebrae.com.br/startup-day-caravana-empreender-com-voce-ev-86728','2026-10-14T00:00:00Z'),
  ('feira-empreendedor-sp-2026','feira-empreendedor-sp',2026,'Feira do Empreendedor Sebrae-SP 2026','2026-10-19','2026-10-22','São Paulo, SP e online','announced','https://feiradoempreendedor.sebraesp.com.br/visitantes/','2026-10-14T00:00:00Z'),
  ('web-summit-rio-2027','web-summit-rio',2027,'Web Summit Rio 2027','2027-06-14','2027-06-17','Rio de Janeiro, RJ','announced','https://rio.websummit.com/web-summit-rio-2027/','2026-10-14T00:00:00Z'),
  ('rio-innovation-week-2026','rio-innovation-week',2026,'Rio Innovation Week 2026','2026-08-04','2026-08-07','Rio de Janeiro, RJ','past','https://www.gov.br/anp/pt-br/acesso-a-informacao/agenda-eventos/rio-innovation-week','2026-10-14T00:00:00Z'),
  ('campus-party-brasil-2026','campus-party-brasil',2026,'Campus Party Brasil CPBR18 2026','2026-06-03','2026-06-07','Brasília, DF','cancelled','https://brasil.campus-party.org/reembolso/','2026-10-14T00:00:00Z')
on conflict (id) do nothing;
