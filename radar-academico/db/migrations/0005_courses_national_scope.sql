alter table opportunities add column if not exists is_course boolean not null default false;
alter table opportunities add column if not exists nationally_eligible boolean not null default false;

comment on column opportunities.is_course is 'Curso explicitamente classificado na fonte oficial; nunca inferido de benefício.';
comment on column opportunities.nationally_eligible is 'Elegibilidade em todo o Brasil confirmada em fonte oficial; localização permanece NULL.';

alter table opportunities drop constraint if exists opportunities_national_scope_valid;
alter table opportunities add constraint opportunities_national_scope_valid check (
  not nationally_eligible or (state_code is null and city_name is null)
);

insert into official_sources
  (id,name,institution_name,institution_acronym,source_type,base_url,
   allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
   audience_scope,geographic_scope,categories,priority,active,verification_status,
   audit_evidence_url,notes)
values
  ('mec-aprenda-mais','MEC — Aprenda Mais','Ministério da Educação','MEC',
   'federal_government','https://aprendamais.mec.gov.br/',
   array['aprendamais.mec.gov.br'],array['/course/'],
   array['https://aprendamais.mec.gov.br/course/index.php'],
   'manual_assisted',array['mixed'],array['Brasil'],array['cursos livres'],70,
   false,'pending','https://aprendamais.mec.gov.br/',
   'Cursos nacionais; cada turma e período de inscrição exigem revisão humana.')
on conflict (id) do nothing;

insert into official_sources
  (id,name,institution_name,institution_acronym,source_type,base_url,
   allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
   audience_scope,geographic_scope,state_code,city_name,categories,priority,
   active,verification_status,audit_evidence_url,notes)
values
  ('ifpe-cursos-2026','IFPE — Cursos gratuitos de qualificação',
   'Instituto Federal de Pernambuco','IFPE','federal_institute',
   'https://portal.ifpe.edu.br/',array['portal.ifpe.edu.br'],array['/noticias/'],
   array['https://portal.ifpe.edu.br/noticias/ifpe-abre-150-vagas-para-cursos-gratuitos-de-qualificacao-profissional/'],
   'manual_assisted',array['mixed'],array['Pernambuco'],'PE',null,
   array['cursos gratuitos'],80,false,'pending',
   'https://portal.ifpe.edu.br/noticias/ifpe-abre-150-vagas-para-cursos-gratuitos-de-qualificacao-profissional/',
   'Inscrições até 23/10/2026; verificar cada curso e campus.'),
  ('ifmg-formiga-energife-2026','IFMG Formiga — EnergIFE',
   'Instituto Federal de Minas Gerais','IFMG','federal_institute',
   'https://www.formiga.ifmg.edu.br/',array['www.formiga.ifmg.edu.br'],
   array['/todas-noticias/'],
   array['https://www.formiga.ifmg.edu.br/todas-noticias/3950-edital-de-vagas-remanescentes-em-cursos-gratuitos-do-programa-energife-com-auxilio-financeiro'],
   'manual_assisted',array['mixed'],array['Minas Gerais'],'MG','Formiga',
   array['cursos gratuitos'],80,false,'pending',
   'https://www.formiga.ifmg.edu.br/todas-noticias/3950-edital-de-vagas-remanescentes-em-cursos-gratuitos-do-programa-energife-com-auxilio-financeiro',
   'Inscrições até 19/10/2026; verificar o edital e vagas remanescentes.')
on conflict (id) do nothing;
