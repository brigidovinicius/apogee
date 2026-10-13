alter table official_sources
  add column if not exists crawl_listing_index integer not null default 0 check (crawl_listing_index >= 0),
  add column if not exists crawl_link_offset integer not null default 0 check (crawl_link_offset >= 0);

comment on column official_sources.crawl_listing_index is 'Índice da URL de listagem a consultar na próxima execução automática.';
comment on column official_sources.crawl_link_offset is 'Posição do próximo link elegível na listagem atual.';

create index if not exists official_sources_due_crawl_idx
  on official_sources(next_crawl_at, priority desc, id)
  where active and verification_status='verified' and extraction_mode in ('rss','html');
