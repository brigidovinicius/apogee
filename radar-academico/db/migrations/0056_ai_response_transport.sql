-- Additive transport controls only. No key, price, allocation, proof or activation.
set local lock_timeout='5s';
set local statement_timeout='60s';
create table radar_ai.response_tariff (
 model text primary key references radar_ai.price(model) on delete cascade,
 price_version text not null check(length(price_version) between 1 and 100),
 approved boolean not null default false, valid_until timestamptz not null,
 input_micro_per_million bigint not null check(input_micro_per_million between 0 and 1000000000),
 cached_input_micro_per_million bigint not null check(cached_input_micro_per_million between 0 and 1000000000),
 cache_write_micro_per_million bigint not null check(cache_write_micro_per_million between 0 and 1000000000),
 output_micro_per_million bigint not null check(output_micro_per_million between 0 and 1000000000)
);
alter table radar_ai.operation add column response_tariff_snapshot jsonb;
alter table radar_ai.operation add column account_snapshot jsonb;
alter table radar_ai.operation add column provider_receipt jsonb check(octet_length(provider_receipt::text)<=2048);

alter function radar_ai.reserve(text,text,text,text,bigint,integer,text,text) rename to budget_reserve;
create function radar_ai.reserve(k text,e text,h text,m text,i bigint,o integer,s text default 'radar',p text default 'normal') returns jsonb
language plpgsql security definer set search_path=pg_catalog,radar_ai,pg_temp as $$
declare tariff radar_ai.response_tariff; bound radar_ai.price; result jsonb; account jsonb; why text;
begin
 perform 1 from radar_ai.control where singleton for update;
 if not found then return jsonb_build_object('status','blocked','reason','control_unavailable'); end if;
 if exists(select 1 from radar_ai.operation where operation_key=k) then return radar_ai.budget_reserve(k,e,h,m,i,o,s,p); end if;
 why:=radar_ai.block_reason();
 if why is not null then return jsonb_build_object('status','blocked','reason',why); end if;
 select * into tariff from radar_ai.response_tariff where model=m and approved and valid_until>now();
 if not found then return jsonb_build_object('status','blocked','reason','price_unverified'); end if;
 select * into bound from radar_ai.price where model=m and approved and valid_until>now() and version=tariff.price_version;
 if not found or greatest(tariff.input_micro_per_million,tariff.cached_input_micro_per_million,tariff.cache_write_micro_per_million)>bound.input_micro_per_million
  or tariff.output_micro_per_million>bound.output_micro_per_million then
  return jsonb_build_object('status','blocked','reason','price_unverified'); end if;
 select jsonb_build_object('organization_id',organization_id,'project_id',project_id) into account from radar_ai.control where singleton;
 result:=radar_ai.budget_reserve(k,e,h,m,i,o,s,p);
 if result->>'status'='reserved' then
  update radar_ai.operation set response_tariff_snapshot=to_jsonb(tariff),account_snapshot=account where id=(result->>'id')::uuid;
  result:=result||jsonb_build_object('response_tariff',to_jsonb(tariff))||account;
 end if;
 return result;
end $$;

alter function radar_ai.mark_sent(uuid) rename to budget_mark_sent;
create function radar_ai.mark_sent(operation_id uuid) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare op radar_ai.operation; account jsonb; why text;
begin
 perform 1 from radar_ai.control where singleton for update;
 if not found then return jsonb_build_object('sent',false,'reason','control_unavailable'); end if;
 select * into op from radar_ai.operation where id=operation_id for update;
 if not found or op.state<>'reserved' then return jsonb_build_object('sent',false,'reason','already_recorded'); end if;
 select jsonb_build_object('organization_id',organization_id,'project_id',project_id) into account from radar_ai.control where singleton;
 if op.account_snapshot is distinct from account then why:='allocation_unverified';
 elsif not exists(select 1 from radar_ai.response_tariff t where t.model=op.model and t.approved and t.valid_until>now()
  and to_jsonb(t)=op.response_tariff_snapshot) then why:='price_changed'; end if;
 if why is not null then
  update radar_ai.operation set state='not_sent',actual_micro=0,finished_at=now(),reason=why where id=operation_id;
  return jsonb_build_object('sent',false,'reason',why);
 end if;
 return radar_ai.budget_mark_sent(operation_id);
end $$;

create function radar_ai.finish_response(oid uuid,cost bigint,receipt jsonb) returns jsonb language plpgsql security definer
set search_path=pg_catalog,radar_ai,pg_temp as $$
declare result jsonb; key text;
begin
 if receipt is null or jsonb_typeof(receipt)<>'object' or octet_length(receipt::text)>2048 or
  coalesce(receipt->>'responseId','')!~'^resp_[A-Za-z0-9_-]{8,200}$' or
  coalesce(receipt->>'requestId','')!~'^req_[A-Za-z0-9_-]{1,200}$' then raise exception 'invalid_receipt'; end if;
 for key in select jsonb_object_keys(receipt) loop
  if key not in ('responseId','requestId','inputTokens','cachedTokens','cacheWriteTokens','outputTokens') then raise exception 'invalid_receipt'; end if;
 end loop;
 foreach key in array array['inputTokens','cachedTokens','cacheWriteTokens','outputTokens'] loop
  if jsonb_typeof(receipt->key) is distinct from 'number' or (receipt->>key)!~'^[0-9]{1,10}$' then raise exception 'invalid_receipt'; end if;
 end loop;
 perform 1 from radar_ai.control where singleton for update;
 perform 1 from radar_ai.operation where id=oid and state='sent' for update;
 if not found then return jsonb_build_object('accepted',false,'reason','already_recorded'); end if;
 result:=radar_ai.finish(oid,'confirmed',cost,null);
 -- Preserve evidence also when an overrun has stopped AI; never overwrite a receipt.
 update radar_ai.operation set provider_receipt=receipt where id=oid and state='confirmed' and provider_receipt is null;
 return result;
end $$;

alter table radar_ai.response_tariff owner to radar_ai_owner;
revoke all on table radar_ai.response_tariff from public,radar_ai_worker,radar_reader,radar_editor;
do $permissions$ declare item record;
begin
 for item in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='radar_ai' and p.proname in ('reserve','mark_sent','finish_response','budget_reserve','budget_mark_sent') loop
  execute format('alter function %s owner to radar_ai_owner',item.signature);
  execute format('revoke all on function %s from public,radar_ai_worker,radar_reader,radar_editor',item.signature);
 end loop;
end $permissions$;
grant execute on function radar_ai.reserve(text,text,text,text,bigint,integer,text,text),radar_ai.mark_sent(uuid),radar_ai.finish_response(uuid,bigint,jsonb) to radar_ai_worker;
