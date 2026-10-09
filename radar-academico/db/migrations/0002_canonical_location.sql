alter table official_sources
  add column if not exists state_code text,
  add column if not exists city_name text;

alter table opportunities
  add column if not exists state_code text,
  add column if not exists city_name text;

alter table official_sources drop constraint if exists official_sources_location_valid;
alter table official_sources add constraint official_sources_location_valid check (
  (state_code is null and city_name is null)
  or (
    state_code in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    and (city_name is null or (length(btrim(city_name)) between 1 and 100 and city_name = btrim(city_name)))
  )
);

alter table opportunities drop constraint if exists opportunities_location_valid;
alter table opportunities add constraint opportunities_location_valid check (
  (state_code is null and city_name is null)
  or (
    state_code in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    and (city_name is null or (length(btrim(city_name)) between 1 and 100 and city_name = btrim(city_name)))
  )
);

create index if not exists opportunities_location_idx on opportunities(state_code, city_name);

comment on column opportunities.state_code is 'UF brasileira estruturada e confirmada pela fonte; NULL significa ausente, nacional ou internacional.';
comment on column opportunities.city_name is 'Cidade vinculada a state_code; nunca inferida de texto livre.';
