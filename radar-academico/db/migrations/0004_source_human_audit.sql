alter table official_sources
  add column if not exists audit_evidence_url text,
  add column if not exists audited_at timestamptz,
  add column if not exists audited_by text;

alter table official_sources drop constraint if exists official_sources_verification_status_valid;
alter table official_sources add constraint official_sources_verification_status_valid check (
  verification_status in ('pending','verified','rejected')
);

comment on column official_sources.audit_evidence_url is 'Página oficial usada pela revisão humana para confirmar instituição e localização da fonte.';
comment on column official_sources.audited_at is 'Momento em que um administrador confirmou a fonte para coleta controlada.';
comment on column official_sources.audited_by is 'Identificador do revisor administrativo que confirmou a fonte.';
