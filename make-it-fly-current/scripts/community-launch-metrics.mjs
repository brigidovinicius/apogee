// Operational aggregates only. No dotenv, identity export, tracking or writes.
import { pathToFileURL } from "node:url";
import postgres from "postgres";
import { databaseOptions } from "./members-grant-admin.mjs";

function day(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw Error("Janela inválida.");
  return value;
}

export async function communityLaunchMetrics(sql, { from, to, mode, asOf = new Date().toISOString() }) {
  day(from);day(to);
  if (from >= to || !["test", "live"].includes(mode) || !/^\d{4}-\d{2}-\d{2}T/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw Error("Parâmetros inválidos.");
  const snapshot = new Date(asOf).toISOString();
  return sql.begin("isolation level repeatable read read only", async tx => {
    await tx`set local statement_timeout = '10s'`;
    const [counts] = await tx`with bounds as (
        select ${from}::date::timestamp at time zone 'America/Sao_Paulo' as start,
          ${to}::date::timestamp at time zone 'America/Sao_Paulo' as finish,${snapshot}::timestamptz as reference
      ), accounts as (
        select u.id,u.created_at from "user" u,bounds b where u.role='member' and not u.blocked and u.email_verified and u.created_at<=b.reference
          and (${mode === "test"} or lower(u.email) !~ '@(example\\.(test|invalid|com|org|net)|[^@]+\\.invalid|[^@]+\\.test)$')
      ), ledger as (
        select s.user_id,s.cancel_at_period_end,i.* from community_subscription s join community_invoice i on i.subscription_id=s.id
          join accounts a on a.id=s.user_id where s.livemode=${mode === "live"}
      ), paid as (
        select * from ledger where status='paid' and not fraud_review_required
      ), active as (
        select p.* from paid p,bounds b where p.period_start<=b.reference and p.period_end>b.reference
      ), first_events as (
        select e.user_id,min(e.opened_at) as opened_at from radar_free_event e join accounts a on a.id=e.user_id group by e.user_id
      ), free_cohort as (
        select a.* from accounts a,bounds b where a.created_at>=b.start and a.created_at<least(b.finish,b.reference)
          and not exists(select 1 from radar_legacy_access r where r.user_id=a.id)
          and not exists(select 1 from radar_purchase p where p.user_id=a.id and p.livemode=${mode === "live"} and p.status='paid')
      ) select
        (select count(*)::int from accounts a,bounds b where a.created_at>=b.start and a.created_at<least(b.finish,b.reference)) as verified_accounts_created,
        (select count(*)::int from free_cohort) as free_cohort_accounts,
        (select count(*)::int from free_cohort a join first_events e on e.user_id=a.id,bounds b
          where e.opened_at>=a.created_at and e.opened_at<least(b.finish,b.reference)
            and date_trunc('week',e.opened_at at time zone 'America/Sao_Paulo')=date_trunc('week',a.created_at at time zone 'America/Sao_Paulo')) as first_event_same_week,
        (select count(distinct user_id)::int from active) as annual_accounts_current,
        (select count(distinct user_id)::int from active where cancel_at_period_end) as active_accounts_renewal_cancelled,
        (select count(*)::int from ledger where fraud_review_required or status in ('fraud','disputed')) as invoices_requiring_review,
        (select count(*)::int from community_checkout_attempt c join accounts a on a.id=c.user_id,bounds b
          where c.livemode=${mode === "live"} and c.expires_at-interval '1 hour'>=b.start and c.expires_at-interval '1 hour'<least(b.finish,b.reference)) as retained_checkout_attempts,
        (select count(*)::int from member_tool t join member_tool_category c on c.id=t.category_id where t.status='published' and c.status='published' and t.reviewed_at is not null) as published_reviewed_tools,
        (select count(*)::int from member_benefit p,bounds b where p.status='published' and p.starts_at<=b.reference and p.ends_at>b.reference) as available_benefits,
        (select count(*)::int from member_learning_module m join member_learning_track t on t.id=m.track_id where m.status='published' and t.status='published'
          and exists(select 1 from member_learning_activity a where a.module_id=m.id and a.status='published')) as available_learning_modules`;
    const [tables] = await tx`select to_regclass('public.community_contact') is not null as contacts,to_regclass('public.apogee_behavior_daily') is not null as behavior`;
    let eventRequests = null, behavior = null;
    if (tables.contacts) {
      const [r] = await tx`select count(*)::int as total from community_contact where campaign='codex'
        and consented_at>=(${from}::date::timestamp at time zone 'America/Sao_Paulo')
        and consented_at<least((${to}::date::timestamp at time zone 'America/Sao_Paulo'),${snapshot}::timestamptz)`;
      eventRequests = r.total;
    }
    if (tables.behavior) {
      // Already aggregated, consent-based counters. Do not join them to accounts.
      behavior = await tx`select page,event,target,sum(count)::text as count from apogee_behavior_daily
        where day>=${from}::date and day<least(${to}::date,(${snapshot}::timestamptz at time zone 'America/Sao_Paulo')::date)
        group by page,event,target order by page,event,target`;
    }
    return {
      mode, synthetic: mode === "test", readOnly: true, from, toExclusive: to, timeZone: "America/Sao_Paulo", asOf: snapshot,
      counts: { ...counts, event_orientation_requests: eventRequests },
      normalizedAnnualCents: counts.annual_accounts_current * 143880,
      normalizedMonthlyCents: counts.annual_accounts_current * 11990,
      firstEventSameWeekRate: counts.free_cohort_accounts ? counts.first_event_same_week / counts.free_cohort_accounts : null,
      consentedDailyBehavior: behavior,
      // The ledger stores paid-through periods, not historical settlement times
      // or refund amounts; progress may be reopened. Never invent exact cohorts.
      conversion30Days: null, activation7Days: null, returnDays8To14: null, cashReceivedCents: null, churn: null,
      limitations: [
        "Snapshot operacional: contas atualmente verificadas/não bloqueadas; exclui administradores e, em live, domínios sintéticos reservados. Outras contas de teste exigem inventário operacional.",
        "Primeira consulta cobre radar_free_event. Escolhas anteriores sem taxonomia persistida não são classificadas por inferência. A coorte corrente pode estar incompleta.",
        "Tentativas de checkout são apenas as linhas retidas por conta/ambiente; uma nova tentativa substitui a anterior. Não são cliques, sessões concluídas ou receita.",
        "Lead e conta são contados separadamente. Não há atribuição individual de campanha, conversão automática ou junção por coincidência de email.",
        "Conversão 30 dias exige data canônica da primeira cobrança; ativação/retorno exigem definição aprovada de resultado e cobertura de consentimento. Valores nulos significam não medido, nunca zero.",
        "Normalização anual/mensal é valor de referência dos pagantes vigentes. Caixa, taxas, reembolsos parciais e churn histórico exigem relatório financeiro canônico da Stripe.",
        "Contadores comportamentais existentes não identificam pessoas/coortes; visitas e cliques não comprovam resultado. Não registrar conteúdo ou IDs para preencher lacunas.",
      ],
    };
  });
}

async function main() {
  const args = process.argv.slice(2), values = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!["--from", "--to", "--mode"].includes(args[i]) || !args[i + 1] || args[i] in values) throw Error("Argumentos inválidos.");
    values[args[i]] = args[i + 1];
  }
  const { url, options } = databaseOptions();
  const sql = postgres(url, { ...options, max: 1, connect_timeout: 10 });
  try { console.log(JSON.stringify(await communityLaunchMetrics(sql, { from: values["--from"], to: values["--to"], mode: values["--mode"] }), null, 2)); }
  finally { await sql.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error("Relatório não concluído. Confira janela, ambiente, permissões de leitura e esquema. Nenhum dado privado foi exibido.");process.exitCode = 1;
});
