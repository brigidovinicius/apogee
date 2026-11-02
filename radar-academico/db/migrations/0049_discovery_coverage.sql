-- Bounded crawl checkpoints and verifiable discovery chains, without activating any target.
alter table discovery_targets add column discovery_crawl jsonb not null default '{}'::jsonb
  check (jsonb_typeof(discovery_crawl)='object' and octet_length(discovery_crawl::text)<=524288);
alter table discovery_leads add column discovery_path text[] not null default '{}'
  check (cardinality(discovery_path)<=4);
