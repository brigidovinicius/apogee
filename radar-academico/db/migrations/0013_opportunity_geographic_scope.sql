-- Keep geographic eligibility distinct from the organizer's address.
alter table opportunities
  add column if not exists geographic_scope_kind text not null default 'unknown',
  add column if not exists country_code text;

update opportunities set
  geographic_scope_kind = case
    when city_name is not null then 'city'
    when state_code is not null then 'state'
    when nationally_eligible then 'country'
    else 'unknown'
  end,
  country_code = case when state_code is not null or nationally_eligible then 'BR' else null end
where geographic_scope_kind = 'unknown';

alter table opportunities add constraint opportunities_geographic_scope_valid check (
  geographic_scope_kind in ('unknown','global','country','state','city')
  and (country_code is null or country_code ~ '^[A-Z]{2}$')
  and (geographic_scope_kind <> 'unknown' or (country_code is null and state_code is null and city_name is null and not nationally_eligible))
  and (geographic_scope_kind <> 'global' or (country_code is null and state_code is null and city_name is null and not nationally_eligible))
  and (geographic_scope_kind <> 'country' or (country_code is not null and state_code is null and city_name is null))
  and (geographic_scope_kind <> 'state' or (country_code is not null and country_code = 'BR' and state_code is not null and city_name is null))
  and (geographic_scope_kind <> 'city' or (country_code is not null and country_code = 'BR' and state_code is not null and city_name is not null))
  and (state_code is null or geographic_scope_kind in ('state','city'))
  and (city_name is null or geographic_scope_kind = 'city')
  and (not nationally_eligible or (geographic_scope_kind = 'country' and country_code = 'BR'))
);

comment on column opportunities.geographic_scope_kind is 'Eligibility coverage proven by the official opportunity page; unknown is not a country.';
comment on column opportunities.country_code is 'ISO 3166-1 alpha-2 country only when geographic eligibility is evidenced; NULL for global or unknown.';
