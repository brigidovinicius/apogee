alter table opportunities add column categories text[] not null default '{}';
alter table opportunities add constraint opportunities_categories_valid check (
  categories <@ array['formacao','bolsas','intercambios','competicoes','pesquisa','carreira','eventos']::text[]
);

-- Classify existing records only from structured fields; ambiguous records stay uncategorized.
select set_config('app.is_admin','true',true);
update opportunities set categories = array_remove(array[
  case when is_course then 'formacao' end,
  case when benefit_type in ('academic_scholarship','research_scholarship','extension_scholarship','monitor_scholarship','financial_aid','housing_aid') then 'bolsas' end,
  case when benefit_type='mobility_aid' then 'intercambios' end,
  case when benefit_type='research_scholarship' then 'pesquisa' end,
  case when benefit_type='internship' then 'carreira' end
], null);
